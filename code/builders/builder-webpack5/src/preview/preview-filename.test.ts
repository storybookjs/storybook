import { describe, expect, it } from 'vitest';

import { createFsFromVolume, Volume } from 'memfs';
import webpack from 'webpack';
import type { PathData } from 'webpack';

import { createPreviewFilename } from './preview-filename.ts';

const filenameFor = (name: string, isProd = false) =>
  createPreviewFilename(isProd)({ chunk: { id: name, name, hash: '' } });

const filenameForChunk = (chunk: { id?: string | number; name?: string }) =>
  createPreviewFilename(false)({
    chunk: { ...chunk, hash: '' } as NonNullable<PathData['chunk']>,
  });

const compile = async (source: string, isProd: boolean) => {
  const entryName = 'preview';
  const longChunkName = `chunk-${'deeply-nested-'.repeat(30)}component`;
  const volume = Volume.fromJSON({
    '/src/entry.js': `import(/* webpackChunkName: "${longChunkName}" */ './async.js');`,
    '/src/async.js': source,
  });
  const filesystem = createFsFromVolume(volume);
  const compiler = webpack({
    context: '/',
    mode: isProd ? 'production' : 'development',
    devtool: false,
    entry: { [entryName]: '/src/entry.js' },
    output: {
      path: '/dist',
      filename: isProd ? '[name].[contenthash:8].iframe.bundle.js' : '[name].iframe.bundle.js',
      chunkFilename: createPreviewFilename(isProd),
    },
  });
  compiler.inputFileSystem = filesystem as typeof compiler.inputFileSystem;
  compiler.outputFileSystem = filesystem as unknown as typeof compiler.outputFileSystem;

  const stats = await new Promise<webpack.Stats>((resolve, reject) => {
    compiler.run((error, result) => {
      if (error) {
        reject(error);
      } else if (result?.hasErrors()) {
        reject(new Error(result.toString({ all: false, errors: true })));
      } else if (result) {
        resolve(result);
      } else {
        reject(new Error('Webpack did not return compilation stats'));
      }
    });
  });
  await new Promise<void>((resolve, reject) =>
    compiler.close((error) => (error ? reject(error) : resolve()))
  );

  return stats.toJson({ all: false, assets: true }).assets?.map(({ name }) => name) ?? [];
};

describe('createPreviewFilename', () => {
  it('keeps normal development chunk names readable', () => {
    expect(filenameFor('src-components-button-stories')).toBe(
      'src-components-button-stories.iframe.bundle.js'
    );
  });

  it('uses the chunk id when the chunk name is empty', () => {
    expect(filenameForChunk({ id: '123', name: '' })).toBe('123.iframe.bundle.js');
  });

  it('uses a generic fallback when the chunk name and id are missing', () => {
    expect(filenameForChunk({ name: '' })).toBe('chunk.iframe.bundle.js');
    expect(filenameForChunk({})).toBe('chunk.iframe.bundle.js');
    expect(createPreviewFilename(false)({})).toBe('chunk.iframe.bundle.js');
  });

  it('retains numeric chunk id zero', () => {
    expect(filenameForChunk({ id: 0, name: '' })).toBe('0.iframe.bundle.js');
  });

  it('bounds long filename components', () => {
    const filename = filenameFor(`src-${'deeply-nested-'.repeat(30)}stories`);

    expect(Buffer.byteLength(filename)).toBeLessThanOrEqual(200);
    expect(filename).toMatch(/^src-deeply-nested-.*-[a-f0-9]{16}\.iframe\.bundle\.js$/);
  });

  it('gives long names with the same prefix different filenames', () => {
    const prefix = `src-${'same-prefix-'.repeat(30)}`;

    expect(filenameFor(`${prefix}first`)).not.toBe(filenameFor(`${prefix}second`));
  });

  it('retains the production content hash placeholder', () => {
    expect(filenameFor('preview', true)).toBe('preview.[contenthash:8].iframe.bundle.js');
    expect(filenameFor('x'.repeat(300), true)).toMatch(
      /-[a-f0-9]{16}\.\[contenthash:8\]\.iframe\.bundle\.js$/
    );
  });

  it('does not change short path-like chunk names', () => {
    expect(filenameFor('src/components/button-stories')).toBe(
      'src/components/button-stories.iframe.bundle.js'
    );
  });

  it('only bounds async chunk filenames and retains production content hashes', async () => {
    const firstBuild = await compile('export default "first";', true);
    const secondBuild = await compile('export default "second";', true);

    expect(firstBuild).toHaveLength(2);
    expect(firstBuild).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^preview\.[a-f0-9]{8}\.iframe\.bundle\.js$/),
        expect.stringMatching(/^chunk-.*-[a-f0-9]{16}\.[a-f0-9]{8}\.iframe\.bundle\.js$/),
      ])
    );
    expect(firstBuild.every((name) => Buffer.byteLength(name) <= 200)).toBe(true);
    expect(secondBuild).not.toEqual(firstBuild);
  });

  it('only bounds async chunk filenames in development', async () => {
    const filenames = await compile('export default "development";', false);

    expect(filenames).toHaveLength(2);
    expect(filenames).toEqual(
      expect.arrayContaining([
        'preview.iframe.bundle.js',
        expect.stringMatching(/^chunk-.*-[a-f0-9]{16}\.iframe\.bundle\.js$/),
      ])
    );
    expect(filenames.every((name) => Buffer.byteLength(name) <= 200)).toBe(true);
  });
});
