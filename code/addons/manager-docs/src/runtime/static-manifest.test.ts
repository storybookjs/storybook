import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import * as memfs from 'memfs';
import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearRegistry } from '../../../../core/src/shared/open-service/server.ts';

import { STATIC_MDX_MANIFEST_FILE } from '../constants.ts';
import { registerMdxSourceService } from '../mdx-source-service/server.ts';
import { emitStaticMdxDuringBuild } from '../server/emit-static-manifest.ts';
import { openDocsPage, openDocsPageFromSource } from './docs-page.ts';
import {
  loadDocsArticle,
  openDocsPageFromManifest,
  parseStaticMdxManifest,
} from './static-manifest.ts';

vi.mock('node:fs/promises', { spy: true });

const source = readFileSync(
  fileURLToPath(new URL('./fixtures/Button.mdx', import.meta.url)),
  'utf8'
);

const entries = [
  {
    type: 'docs',
    id: 'button--docs',
    importPath: 'src/Button.mdx',
  },
  {
    type: 'story',
    id: 'button--primary',
    importPath: 'src/Button.stories.ts',
    exportName: 'Primary',
    args: { label: 'Hello' },
  },
  {
    type: 'story',
    id: 'button--secondary',
    importPath: 'src/Button.stories.ts',
    exportName: 'Secondary',
    args: { label: 'Bye' },
  },
];

const globals = { viewport: 'desktop' };

describe('static MDX manifest', () => {
  beforeEach(() => {
    vol.reset();
    vol.fromJSON({ '/proj/src/Button.mdx': source });
    vi.mocked(mkdir).mockImplementation(memfs.fs.promises.mkdir as unknown as typeof mkdir);
    vi.mocked(readFile).mockImplementation(
      memfs.fs.promises.readFile as unknown as typeof readFile
    );
    vi.mocked(writeFile).mockImplementation(
      memfs.fs.promises.writeFile as unknown as typeof writeFile
    );
  });

  afterEach(() => {
    clearRegistry();
  });

  it('reconstructs the development page model from the emitted asset', async () => {
    const viaDev = await openDocsPage({
      file: 'src/Button.mdx',
      entries,
      globals,
      readSource: async () => source,
    });

    const assetPath = await emitStaticMdxDuringBuild(
      {
        configType: 'PRODUCTION',
        outputDir: '/out',
        presets: {
          apply: async () => ({
            getIndex: async () => ({
              entries: Object.fromEntries(entries.map((entry) => [entry.id, entry])),
            }),
          }),
        },
      },
      '/proj'
    );
    const emitted = parseStaticMdxManifest(
      await readFile(`/out/${STATIC_MDX_MANIFEST_FILE}`, 'utf8')
    );
    const viaStatic = openDocsPageFromManifest(emitted, 'src/Button.mdx', globals);

    expect(assetPath).toBe(`/out/${STATIC_MDX_MANIFEST_FILE}`);
    expect(viaStatic.model).toEqual(viaDev.model);
    expect(viaStatic.model.instances.map((instance) => instance.storyId)).toEqual([
      'button--primary',
      'button--secondary',
    ]);
    expect(viaStatic.model.instances.map((instance) => instance.focus)).toEqual([false, true]);
  });

  it('loads development MDX through the open service and skips the static file', async () => {
    const reads: string[] = [];
    registerMdxSourceService({
      read: async (importPath) => {
        reads.push(importPath);
        return source;
      },
    });

    const viaDev = await loadDocsArticle({
      file: 'src/Button.mdx',
      entries,
      globals,
      production: false,
      readManifest: async () => {
        throw new Error('dev must not read the static manifest');
      },
    });
    const skipped = await emitStaticMdxDuringBuild({
      configType: 'DEVELOPMENT',
      outputDir: '/out',
    });

    expect(reads).toEqual(['src/Button.mdx']);
    expect(skipped).toBeUndefined();
    expect(vol.toJSON()[`/out/${STATIC_MDX_MANIFEST_FILE}`]).toBeUndefined();
    expect(viaDev.model.instances).toHaveLength(2);
  });

  it('reconstructs the page model when story index paths start with ./', async () => {
    const docsFile = './src/Button.mdx';
    const indexed = [
      { type: 'docs', id: 'button--docs', importPath: docsFile },
      {
        type: 'story',
        id: 'button--primary',
        importPath: './src/Button.stories.ts',
        exportName: 'Primary',
        args: { label: 'Hello' },
      },
      {
        type: 'story',
        id: 'button--secondary',
        importPath: './src/Button.stories.tsx',
        exportName: 'Secondary',
        args: { label: 'Bye' },
      },
    ];
    const direct = openDocsPageFromSource({
      file: docsFile,
      source,
      entries: indexed,
      globals,
    });

    await emitStaticMdxDuringBuild(
      {
        configType: 'PRODUCTION',
        outputDir: '/out',
        presets: {
          apply: async () => ({
            getIndex: async () => ({
              entries: Object.fromEntries(indexed.map((entry) => [entry.id, entry])),
            }),
          }),
        },
      },
      '/proj'
    );
    const viaStatic = openDocsPageFromManifest(
      parseStaticMdxManifest(await readFile(`/out/${STATIC_MDX_MANIFEST_FILE}`, 'utf8')),
      docsFile,
      globals
    );

    expect(viaStatic.model).toEqual(direct.model);
    expect(direct.model.instances.map((instance) => instance.storyId)).toEqual([
      'button--primary',
      'button--secondary',
    ]);
    expect(direct.model.instances.map((instance) => instance.focus)).toEqual([false, true]);
    expect(direct.model.instances.map((instance) => instance.args)).toEqual([
      { label: 'Hello' },
      { label: 'Bye' },
    ]);
  });
});
