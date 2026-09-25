import { logger } from 'storybook/internal/node-logger';

import { readFile, stat } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';

import { ManifestManager } from './manifest-manager.ts';
import type { ManifestPackage } from './types.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
  vi.mocked(readFile).mockImplementation(memfs.promises.readFile as typeof readFile);
  vi.mocked(stat).mockImplementation(memfs.promises.stat as typeof stat);
  vi.mocked(logger.warn).mockImplementation(() => {});
  vi.mocked(logger.debug).mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const MANIFEST_PATH = '/workspace/custom-elements.json';
const SECOND_MANIFEST_PATH = '/workspace/second-elements.json';

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

const schemaWarningManifest = (): ManifestPackage =>
  ({
    schemaVersion: '1.0.0',
    modules: [
      {
        kind: 'javascript-module',
        path: 'element.js',
        declarations: [
          {
            name: 'XElement',
            kind: 'class',
            customElement: true,
            tagName: 'x-schema',
            members: [{ name: 'value' }],
          },
        ],
      },
    ],
  }) as unknown as ManifestPackage;

const writeManifest = (
  path: string,
  source: ManifestPackage | Record<string, unknown> | string,
  mtimeMs = 1_000
): void => {
  memfs.mkdirSync('/workspace', { recursive: true });
  memfs.writeFileSync(path, typeof source === 'string' ? source : JSON.stringify(source));
  memfs.utimesSync(path, new Date(mtimeMs), new Date(mtimeMs));
};

describe('ManifestManager', () => {
  it('shares one in-flight refresh between concurrent callers', async () => {
    writeManifest(MANIFEST_PATH, manifest('x-card'));
    const manager = new ManifestManager([MANIFEST_PATH]);

    const [first, second] = await Promise.all([manager.refresh(), manager.refresh()]);

    expect(first).toBe(second);
    expect(first.tags.get('x-card')?.declaration.name).toBe('XElement');
    expect(readFile).toHaveBeenCalledTimes(1);
  });

  it('resolves changed tags after mtime bumps', async () => {
    writeManifest(MANIFEST_PATH, manifest('x-old'), 1_000);
    const manager = new ManifestManager([MANIFEST_PATH]);

    expect((await manager.refresh()).tags.get('x-old')?.declaration.name).toBe('XElement');

    writeManifest(MANIFEST_PATH, manifest('x-new'), 2_000);
    const snapshot = await manager.refresh();

    expect(snapshot.tags.get('x-old')).toBeUndefined();
    expect(snapshot.tags.get('x-new')?.declaration.name).toBe('XElement');
  });

  it('does not re-read an invalid manifest until its mtime changes', async () => {
    writeManifest(MANIFEST_PATH, '{nope', 1_000);
    const manager = new ManifestManager([MANIFEST_PATH]);

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
      const manager = new ManifestManager([MANIFEST_PATH]);
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
    const manager = new ManifestManager([MANIFEST_PATH]);

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
    const manager = new ManifestManager([MANIFEST_PATH]);

    expect((await manager.refresh()).tags.size).toBe(0);

    writeManifest(MANIFEST_PATH, manifest('x-ready'), 1_000);

    expect((await manager.refresh()).tags.get('x-ready')?.manifestPath).toBe(
      'custom-elements.json'
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('keeps schema-violating manifests with a warning', async () => {
    writeManifest(MANIFEST_PATH, schemaWarningManifest());
    const manager = new ManifestManager([MANIFEST_PATH]);

    const tag = (await manager.refresh()).tags.get('x-schema');

    expect(tag?.warning).toMatch(/1 schema violation/);
    expect(tag?.warning).toContain('/modules/0/declarations/0/members/0');
    expect(tag?.declaration.name).toBe('XElement');
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
    const manager = new ManifestManager([MANIFEST_PATH]);

    const snapshot = await manager.refresh();
    const tag = snapshot.tags.get('x-good');

    expect(snapshot.errors).toEqual([]);
    expect([...snapshot.tags.keys()]).toEqual(['x-good']);
    expect(tag?.declaration.name).toBe('GoodElement');
    expect(tag?.warning).toMatch(/^custom-elements\.json has \d+ schema violation\(s\);/);
  });

  it('keeps the handed-out schema warning snapshot untouched after a failed reload', async () => {
    writeManifest(MANIFEST_PATH, schemaWarningManifest(), 1_000);
    const manager = new ManifestManager([MANIFEST_PATH]);
    const loaded = await manager.refresh();
    const schemaWarning = loaded.tags.get('x-schema')?.warning;

    writeManifest(MANIFEST_PATH, '{nope', 2_000);
    const stale = await manager.refresh();

    expect(stale.tags.get('x-schema')?.warning).toMatch(/using the last valid version$/);
    expect(loaded.tags.get('x-schema')?.warning).toBe(schemaWarning);
    expect(schemaWarning).toContain('schema violation');
  });

  it('resolves duplicate tags from the first manifest in configuration order', async () => {
    writeManifest(MANIFEST_PATH, manifest('x-same', 'FirstElement'));
    writeManifest(SECOND_MANIFEST_PATH, manifest('x-same', 'SecondElement'));
    const manager = new ManifestManager([MANIFEST_PATH, SECOND_MANIFEST_PATH]);

    expect((await manager.refresh()).tags.get('x-same')?.declaration.name).toBe('FirstElement');
  });
});
