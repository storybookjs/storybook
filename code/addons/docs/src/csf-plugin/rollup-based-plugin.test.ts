import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readFile } from 'node:fs/promises';
import { SourceMap, type SourceMapPayload } from 'node:module';
import { resolve } from 'node:path';

import { formatCsf, loadCsf } from 'storybook/internal/csf-tools';

import MagicString from 'magic-string';
import { vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { rollupBasedPlugin } from './rollup-based-plugin.ts';

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

const makeTitle = (title: string) => title || 'default';

const reprint = (code: string) =>
  formatCsf(
    loadCsf(code, { makeTitle }).parse(),
    { sourceMaps: true, sourceFileName: id },
    code
  ) as {
    code: string;
    map: SourceMapPayload;
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
    const input = reprint(originalCode);
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
