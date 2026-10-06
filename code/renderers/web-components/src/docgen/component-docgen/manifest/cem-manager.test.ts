import { logger } from 'storybook/internal/node-logger';

import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';

import { CemManager } from './cem-manager.ts';
import type { ManifestPackage } from './types.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.spyOn(process, 'cwd').mockReturnValue(WORKSPACE);
  vi.mocked(readFile).mockImplementation(memfs.promises.readFile as typeof readFile);
  vi.mocked(stat).mockImplementation(memfs.promises.stat as typeof stat);
  vi.mocked(logger.warn).mockImplementation(() => {});
  vi.mocked(logger.debug).mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const WORKSPACE = resolve('/workspace');
const MANIFEST_PATH = resolve(WORKSPACE, 'custom-elements.json');
const SECOND_MANIFEST_PATH = resolve(WORKSPACE, 'second-elements.json');

const manifest = (tagName: string, name = 'XElement'): ManifestPackage => ({
  schemaVersion: '1.0.0',
  modules: [
    {
      kind: 'javascript-module',
      path: 'element.js',
      declarations: [{ name, kind: 'class', customElement: true, tagName }],
    },
  ],
});

const writeManifest = (
  path: string,
  source: ManifestPackage | Record<string, unknown> | string,
  mtimeMs = 1_000
): void => {
  memfs.mkdirSync(WORKSPACE, { recursive: true });
  memfs.writeFileSync(path, typeof source === 'string' ? source : JSON.stringify(source));
  memfs.utimesSync(path, new Date(mtimeMs), new Date(mtimeMs));
};

describe('CemManager', () => {
  it('shares one in-flight refresh between concurrent callers', async () => {
    writeManifest(MANIFEST_PATH, manifest('x-card'));
    const manager = new CemManager([MANIFEST_PATH]);

    const [first, second] = await Promise.all([manager.refresh(), manager.refresh()]);

    expect(first.tags.get('x-card')?.declaration.name).toBe('XElement');
    expect(second.tags.get('x-card')?.declaration.name).toBe('XElement');
    expect(readFile).toHaveBeenCalledTimes(1);
  });

  it('logs every reload at debug level', async () => {
    writeManifest(MANIFEST_PATH, manifest('x-old'), 1_000);
    const manager = new CemManager([MANIFEST_PATH]);
    await manager.refresh();

    writeManifest(MANIFEST_PATH, manifest('x-new'), 2_000);
    await manager.refresh();

    expect(logger.debug).toHaveBeenCalledTimes(2);
  });

  it('does not re-log an unchanged stale warning when the invalid file is touched', async () => {
    writeManifest(MANIFEST_PATH, manifest('x-old'), 1_000);
    const manager = new CemManager([MANIFEST_PATH]);
    await manager.refresh();

    writeManifest(MANIFEST_PATH, '{ not json', 2_000);
    await manager.refresh();
    writeManifest(MANIFEST_PATH, '{ not json', 3_000);
    await manager.refresh();

    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('logs the stale warning again after a clean load in between', async () => {
    writeManifest(MANIFEST_PATH, manifest('x-old'), 1_000);
    const manager = new CemManager([MANIFEST_PATH]);
    await manager.refresh();
    writeManifest(MANIFEST_PATH, '{ not json', 2_000);
    await manager.refresh();
    writeManifest(MANIFEST_PATH, manifest('x-old'), 3_000);
    await manager.refresh();
    writeManifest(MANIFEST_PATH, '{ not json', 4_000);
    await manager.refresh();

    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('serves a write that lands while a shared refresh awaits stat', async () => {
    writeManifest(MANIFEST_PATH, manifest('x-old'), 1_000);
    const manager = new CemManager([MANIFEST_PATH]);
    await manager.refresh();
    let releaseStat!: () => void;
    const statGate = new Promise<void>((resolveGate) => {
      releaseStat = resolveGate;
    });
    vi.mocked(stat).mockImplementationOnce((async (path: string) => {
      const stats = await memfs.promises.stat(path);
      await statGate;
      return stats;
    }) as typeof stat);

    const inFlight = manager.refresh();
    await vi.waitFor(() => expect(stat).toHaveBeenCalledTimes(2));
    writeManifest(MANIFEST_PATH, manifest('x-new'), 2_000);
    const afterWrite = manager.refresh();
    releaseStat();
    await inFlight;

    expect((await afterWrite).tags.get('x-new')?.declaration.name).toBe('XElement');
  });

  it('reloads after a stat failure clears', async () => {
    writeManifest(MANIFEST_PATH, manifest('x-old'), 1_000);
    const manager = new CemManager([MANIFEST_PATH]);
    await manager.refresh();
    vi.mocked(stat).mockRejectedValueOnce(Object.assign(new Error('EISDIR'), { code: 'EISDIR' }));
    const failed = await manager.refresh();
    expect(failed.tags.get('x-old')?.warning).toContain('using the last valid version');

    const recovered = await manager.refresh();

    expect(recovered.tags.get('x-old')?.warning).toBeUndefined();
    expect(readFile).toHaveBeenCalledTimes(2);
  });

  it('resolves changed tags after mtime bumps', async () => {
    writeManifest(MANIFEST_PATH, manifest('x-old'), 1_000);
    const manager = new CemManager([MANIFEST_PATH]);

    expect((await manager.refresh()).tags.get('x-old')?.declaration.name).toBe('XElement');

    writeManifest(MANIFEST_PATH, manifest('x-new'), 2_000);
    const snapshot = await manager.refresh();

    expect(snapshot.tags.get('x-old')).toBeUndefined();
    expect(snapshot.tags.get('x-new')?.declaration.name).toBe('XElement');
  });

  it('does not re-read an invalid manifest until its mtime changes', async () => {
    writeManifest(MANIFEST_PATH, '{nope', 1_000);
    const manager = new CemManager([MANIFEST_PATH]);

    expect((await manager.refresh()).errors).toMatchObject([{ name: 'manifest-invalid' }]);
    expect((await manager.refresh()).errors).toMatchObject([{ name: 'manifest-invalid' }]);
    expect(readFile).toHaveBeenCalledTimes(1);

    writeManifest(MANIFEST_PATH, '{still nope', 2_000);

    expect((await manager.refresh()).errors).toMatchObject([{ name: 'manifest-invalid' }]);
    expect(readFile).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      name: 'invalid JSON',
      source: '{nope',
      expectedWarning: 'Invalid Custom Elements Manifest at custom-elements.json:',
    },
    {
      name: 'web-component-analyzer shape',
      source: { version: 'experimental', tags: [] },
      expectedWarning:
        'custom-elements.json uses the web-component-analyzer manifest shape. The Storybook docgen server reads Custom Elements Manifests only',
    },
  ])(
    'keeps the last valid manifest when reload sees $name',
    async ({ source, expectedWarning }) => {
      writeManifest(MANIFEST_PATH, manifest('x-old'), 1_000);
      const manager = new CemManager([MANIFEST_PATH]);
      await manager.refresh();

      writeManifest(MANIFEST_PATH, source, 2_000);

      const snapshot = await manager.refresh();

      expect(snapshot.errors).toEqual([]);
      expect(snapshot.tags.get('x-old')?.declaration.name).toBe('XElement');
      expect(snapshot.tags.get('x-old')?.warning).toContain(expectedWarning);
      expect(snapshot.tags.get('x-old')?.warning).toMatch(/using the last valid version$/);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    }
  );

  it('reports a missing manifest as manifest-not-found', async () => {
    const manager = new CemManager([MANIFEST_PATH]);

    expect(await manager.refresh()).toMatchObject({
      errors: [
        {
          name: 'manifest-not-found',
          message:
            'Custom Elements Manifest custom-elements.json not found yet; docs load once the analyzer writes it',
        },
      ],
      paths: ['custom-elements.json'],
    });
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('loads a manifest that appears after it was missing at startup', async () => {
    const manager = new CemManager([MANIFEST_PATH]);

    expect((await manager.refresh()).tags.size).toBe(0);

    writeManifest(MANIFEST_PATH, manifest('x-ready'), 1_000);

    expect((await manager.refresh()).tags.get('x-ready')?.manifestPath).toBe(
      'custom-elements.json'
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('keeps valid tags from manifests with malformed nested values', async () => {
    writeManifest(MANIFEST_PATH, {
      schemaVersion: '1.0.0',
      modules: [
        null,
        {
          kind: 'javascript-module',
          path: 'bad-declarations.js',
          declarations: 'bad',
        },
        {
          kind: 'javascript-module',
          path: 'bad-export.js',
          exports: [
            {
              kind: 'custom-element-definition',
              name: 'x-broken',
              declaration: null,
            },
          ],
        },
        {
          kind: 'javascript-module',
          path: 'good.js',
          declarations: [
            {
              name: 'GoodElement',
              kind: 'class',
              customElement: true,
              tagName: 'x-good',
            },
          ],
        },
      ],
    } as unknown as ManifestPackage);
    const manager = new CemManager([MANIFEST_PATH]);

    const snapshot = await manager.refresh();
    const tag = snapshot.tags.get('x-good');

    expect(snapshot.errors).toEqual([]);
    expect([...snapshot.tags.keys()]).toEqual(['x-good']);
    expect(tag?.declaration.name).toBe('GoodElement');
    expect(tag?.warning).toBeUndefined();
  });

  it('keeps a handed-out snapshot untouched after a failed reload', async () => {
    writeManifest(MANIFEST_PATH, manifest('x-valid'), 1_000);
    const manager = new CemManager([MANIFEST_PATH]);
    const loaded = await manager.refresh();

    writeManifest(MANIFEST_PATH, '{nope', 2_000);
    const stale = await manager.refresh();

    expect(stale.tags.get('x-valid')?.warning).toMatch(/using the last valid version$/);
    expect(loaded.tags.get('x-valid')?.warning).toBeUndefined();
  });

  it('resolves duplicate tags from the first manifest in configuration order', async () => {
    writeManifest(MANIFEST_PATH, manifest('x-same', 'FirstElement'));
    writeManifest(SECOND_MANIFEST_PATH, manifest('x-same', 'SecondElement'));
    const manager = new CemManager([MANIFEST_PATH, SECOND_MANIFEST_PATH]);

    expect((await manager.refresh()).tags.get('x-same')?.declaration.name).toBe('FirstElement');
  });
});
