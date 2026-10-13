import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readFile } from 'node:fs/promises';
import { SourceMap, type SourceMapPayload } from 'node:module';
import { resolve } from 'node:path';

import { formatCsf } from 'storybook/internal/csf-tools';
import type { CsfEnricher } from 'storybook/internal/types';

import MagicString from 'magic-string';
import { vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { rollupBasedPlugin, transformCsf } from './rollup-based-plugin.ts';

vi.mock('node:fs/promises', { spy: true });

type TransformHook = (
  this: { getCombinedSourcemap: () => SourceMapPayload },
  code: string,
  id: string
) => Promise<{ code: string; map: SourceMapPayload } | string | undefined>;

const id = resolve('/src/Repro.stories.js');

const originalCode = dedent`
  import { expect } from 'storybook/test';

  export default {
    title: 'Repro',
    render: () => '<div>repro</div>',
  };

  export const A = { args: { a: 1, b: 2, c: 3 }, parameters: { x: { y: 1 } } };
  export const B = { args: { a: 1, b: 2, c: 3 }, parameters: { x: { y: 1 } } };
  export const C = { args: { a: 1, b: 2, c: 3 }, parameters: { x: { y: 1 } } };

  export const Failing = {
    play: async () => {
      expect(1).toBe(2);
    },
  };
`;

// An earlier transform in the chain, such as `vite-plugin-storybook-test`, that moves code down.
const earlierTransform = (code: string) => {
  const edited = new MagicString(code).prepend("import { setup } from 'earlier-transform';\n\n");
  return {
    code: edited.toString(),
    map: edited.generateMap({
      hires: 'boundary',
      source: id,
      includeContent: true,
    }) as unknown as SourceMapPayload,
  };
};

const positionOf = (code: string, token: string) => {
  const line = code.split('\n').findIndex((text) => text.includes(token));
  return { line, column: code.split('\n')[line].indexOf(token) };
};

const transform = rollupBasedPlugin({}).transform as unknown as TransformHook;

describe('rollupBasedPlugin', () => {
  beforeEach(async () => {
    const memfs = await vi.importActual<typeof import('memfs')>('memfs');
    vi.mocked(readFile).mockImplementation(
      memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
    );
    vol.reset();
    vol.fromJSON({ [id]: originalCode });
  });

  it('maps the output to the transform input instead of the combined sourcemap', async () => {
    const input = earlierTransform(originalCode);
    const inputPosition = positionOf(input.code, 'play:');
    expect(inputPosition.line).not.toBe(positionOf(originalCode, 'play:').line);

    const result = await transform.call({ getCombinedSourcemap: () => input.map }, input.code, id);
    if (typeof result !== 'object') {
      throw new Error('expected a transform result with a sourcemap');
    }

    const outputPosition = positionOf(result.code, 'play:');
    const entry = new SourceMap(result.map).findEntry(outputPosition.line, outputPosition.column);

    expect(entry).toMatchObject({
      originalLine: inputPosition.line,
      originalColumn: inputPosition.column,
    });
    expect(result.map.sourcesContent).toEqual([input.code]);
  });

  it('maps the output to the original story file when no earlier transform ran', async () => {
    const identity = new MagicString(originalCode).generateMap({
      hires: 'boundary',
      source: id,
      includeContent: true,
    }) as unknown as SourceMapPayload;

    const result = await transform.call({ getCombinedSourcemap: () => identity }, originalCode, id);
    if (typeof result !== 'object') {
      throw new Error('expected a transform result with a sourcemap');
    }

    const outputPosition = positionOf(result.code, 'play:');
    const entry = new SourceMap(result.map).findEntry(outputPosition.line, outputPosition.column);

    expect(entry).toMatchObject({ originalLine: positionOf(originalCode, 'play:').line });
    expect(result.map.sourcesContent).toEqual([originalCode]);
  });
});

describe('transformCsf', () => {
  const storyId = resolve('/project/Button.stories.tsx');
  const enrichCsf = vi.fn<CsfEnricher>();

  const source = `
/** Button component */
export default { title: 'Button' };

/** The primary button */
export const Primary = { args: { label: 'Primary' } };
`;

  const transform = async (code: string, options = {}) => {
    const result = await transformCsf(code, storyId, options);
    return typeof result === 'string' ? result : result?.code;
  };

  beforeEach(async () => {
    const memfs = await vi.importActual<typeof import('memfs')>('memfs');
    vi.mocked(readFile).mockImplementation(
      memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
    );
    vi.mocked(enrichCsf).mockReset();
    vi.mocked(enrichCsf).mockResolvedValue(undefined);
    vol.reset();
    vol.fromJSON({ [storyId]: source });
  });

  it('enriches an untransformed story file with its source and descriptions', async () => {
    const code = await transform(source);

    expect(code).toContain('component: "Button component"');
    expect(code).toContain('story: "The primary button"');
    expect(code).toContain(`originalSource: "{ args: { label: 'Primary' } }"`);
  });

  it('takes the original source from the story file when the code was transformed', async () => {
    const transformed = source.replace(`label: 'Primary'`, `label: 'Transformed'`);

    const code = await transform(transformed);

    expect(code).toContain(`label: 'Transformed'`);
    expect(code).toContain(`originalSource: "{ args: { label: 'Primary' } }"`);
  });

  it('leaves the source passed to enrichCsf hooks unenriched', async () => {
    expect.assertions(3);
    enrichCsf.mockImplementation(async (csf, csfSource) => {
      const sourceCode = formatCsf(csfSource) as string;
      expect(sourceCode).toContain('/** Button component */');
      expect(sourceCode).not.toContain('component: "Button component"');
      expect(formatCsf(csf)).toContain('component: "Button component"');
    });

    await transform(source, { enrichCsf });
  });
});
