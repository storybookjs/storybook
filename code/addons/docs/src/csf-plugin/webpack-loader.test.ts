import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readFile } from 'node:fs/promises';
import { SourceMap, type SourceMapPayload } from 'node:module';
import { resolve } from 'node:path';

import MagicString from 'magic-string';
import { vol } from 'memfs';
import { dedent } from 'ts-dedent';

import loader from './webpack-loader.ts';

vi.mock('node:fs/promises', { spy: true });

const id = resolve('/src/Button.stories.tsx');

const originalCode = dedent`
  import type { Meta } from '@storybook/react';

  export default { title: 'Button' } satisfies Meta;

  export const Primary = {
    play: async () => {},
  };
`;

// What an earlier loader such as swc-loader hands over: transpiled code plus its map.
const transpile = (code: string) => {
  const edited = new MagicString(code)
    .remove(0, code.indexOf('\n') + 2)
    .replace(' satisfies Meta', '');
  return {
    code: edited.toString(),
    map: edited.generateMap({ hires: 'boundary', source: id, includeContent: true }),
  };
};

const positionOf = (code: string, token: string) => {
  const line = code.split('\n').findIndex((text) => text.includes(token));
  return { line, column: code.split('\n')[line].indexOf(token) };
};

const run = (content: string, map: unknown) =>
  new Promise<{ code: string; map: SourceMapPayload }>((done, fail) => {
    loader.call(
      {
        async: () => (error, code, result) =>
          error ? fail(error) : done({ code: code!, map: result }),
        getOptions: () => ({}),
        resourcePath: id,
      },
      content,
      map
    );
  });

describe('webpack loader', () => {
  beforeEach(async () => {
    const memfs = await vi.importActual<typeof import('memfs')>('memfs');
    vi.mocked(readFile).mockImplementation(
      memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
    );
    vol.reset();
    vol.fromJSON({ [id]: originalCode });
  });

  it('maps the enriched output through the incoming source map', async () => {
    const transpiled = transpile(originalCode);
    expect(positionOf(transpiled.code, 'play:').line).not.toBe(
      positionOf(originalCode, 'play:').line
    );

    const result = await run(transpiled.code, transpiled.map);

    expect(result.code).toContain('originalSource');
    const output = positionOf(result.code, 'play:');
    const entry = new SourceMap(result.map).findEntry(output.line, output.column);
    expect(entry).toMatchObject({
      originalLine: positionOf(originalCode, 'play:').line,
      originalSource: id,
    });
    expect(result.map.sources).toEqual([id]);
    expect(result.map.sourcesContent).toEqual([originalCode]);
  });

  it('leaves the content unknown when the incoming map has none', async () => {
    const transpiled = transpile(originalCode);
    const result = await run(transpiled.code, { ...transpiled.map, sourcesContent: undefined });

    expect(result.map.sources).toEqual([id]);
    expect(result.map.sourcesContent).toEqual([null]);
  });

  it('maps to the loaded code when no earlier loader ran', async () => {
    const result = await run(originalCode, undefined);

    const output = positionOf(result.code, 'play:');
    const entry = new SourceMap(result.map).findEntry(output.line, output.column);
    expect(entry).toMatchObject({ originalLine: positionOf(originalCode, 'play:').line });
  });
});
