import { realpathSync } from 'node:fs';

import { vol } from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockNodePath } from '../test-support/mock-node-path.ts';
import { checkInstallation } from './installation.ts';

vi.mock('node:fs', { spy: true });
vi.mock('node:path', { spy: true });

beforeEach(async () => {
  vol.reset();
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vi.mocked(realpathSync).mockImplementation(
    memfs.fs.realpathSync as unknown as typeof import('node:fs').realpathSync
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkInstallation', () => {
  it('attaches when the record and the caller share the same storybook package root', () => {
    vol.fromNestedJSON({ '/project/node_modules/storybook/package.json': '{"name":"storybook"}' });

    expect(
      checkInstallation(
        { storybookPath: '/project/node_modules/storybook' },
        '/project/node_modules/storybook'
      )
    ).toEqual({ ok: true });
  });

  it('refuses two different installations, reporting both realpathed roots', () => {
    vol.fromNestedJSON({
      '/npx-cache/node_modules/storybook/package.json': '{"name":"storybook"}',
    });

    expect(
      checkInstallation(
        { storybookPath: '/npx-cache/node_modules/storybook' },
        '/project/node_modules/storybook'
      )
    ).toEqual({
      ok: false,
      reason: 'different-installation',
      callerPath: '/project/node_modules/storybook',
      instancePath: '/npx-cache/node_modules/storybook',
    });
  });

  it('attaches a symlinked layout of the same installation', () => {
    vol.fromNestedJSON({ '/store/storybook/package.json': '{"name":"storybook"}' });
    vol.mkdirSync('/project/node_modules', { recursive: true });
    vol.symlinkSync('/store/storybook', '/project/node_modules/storybook');

    expect(
      checkInstallation({ storybookPath: '/project/node_modules/storybook' }, '/store/storybook')
    ).toEqual({ ok: true });
  });

  it('attaches Windows paths that differ only by letter case', () => {
    mockNodePath('win32');
    vol.fromNestedJSON({ '/project/node_modules/storybook/package.json': '{"name":"storybook"}' });

    expect(
      checkInstallation(
        { storybookPath: '/project/node_modules/storybook' },
        '/PROJECT/NODE_MODULES/STORYBOOK'
      )
    ).toEqual({ ok: true });
  });

  it('refuses a record that does not name its installation', () => {
    expect(checkInstallation({}, '/store/storybook')).toEqual({
      ok: false,
      reason: 'unknown-installation',
    });
  });

  it('refuses a recorded installation that no longer exists on disk', () => {
    expect(
      checkInstallation({ storybookPath: '/gone/node_modules/storybook' }, '/store/storybook')
    ).toEqual({ ok: false, reason: 'unknown-installation' });
  });

  it('refuses when the caller cannot derive its own package root', () => {
    vol.fromNestedJSON({ '/project/node_modules/storybook/package.json': '{"name":"storybook"}' });

    expect(
      checkInstallation({ storybookPath: '/project/node_modules/storybook' }, undefined)
    ).toEqual({ ok: false, reason: 'unknown-installation' });
  });
});
