import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dirname, join } from 'pathe';

import { getImplicitAddons, loadAllPresets } from './presets.ts';

// The shared setup stubs module loading; these tests load real presets from a temp project.
vi.mock('../shared/utils/module.ts', async (importOriginal) => importOriginal());

let root: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'sb-implicit-addons-')));
  write({
    'node_modules/@storybook/addon-vitest/package.json': JSON.stringify({
      name: '@storybook/addon-vitest',
      type: 'module',
      exports: { './preset': './preset.js', './manager': './manager.js' },
    }),
    // Counts how often the preset loads, through the value it adds to.
    'node_modules/@storybook/addon-vitest/preset.js':
      'export const isAddonVitestEnabled = true;\nexport const addonVitestLoads = (count = 0) => count + 1;',
    'node_modules/@storybook/addon-vitest/manager.js': '',
  });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(files: Record<string, string>) {
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
}

const PLUGIN_CONFIG = `import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
export default { test: { projects: [{ plugins: [storybookTest()] }] } };`;

const configDir = () => join(root, '.storybook');

const loadAddonVitestCount = async (isCritical = false) => {
  const presets = await loadAllPresets({
    configDir: configDir(),
    corePresets: [],
    overridePresets: [],
    isCritical,
    channel: undefined as never,
  } as Parameters<typeof loadAllPresets>[0]);
  return presets.apply('addonVitestLoads', 0);
};

describe('getImplicitAddons', () => {
  // SB-2534 (GitButler): the project runs its story tests through the plugin in vite.config.ts,
  // and main.ts lists only addon-docs and addon-links.
  it('enables addon-vitest when a Vitest config uses its plugin for this Storybook', async () => {
    write({ 'vite.config.ts': PLUGIN_CONFIG });

    expect(await getImplicitAddons(configDir())).toEqual([
      expect.objectContaining({
        type: 'virtual',
        name: '@storybook/addon-vitest',
        presets: [{ name: join(root, 'node_modules/@storybook/addon-vitest/preset.js') }],
      }),
    ]);
  });

  it('adds nothing when no Vitest config uses the plugin', async () => {
    write({ 'vite.config.ts': '// storybookTest() was removed\nexport default {};' });

    expect(await getImplicitAddons(configDir())).toEqual([]);
  });

  // A monorepo root config that runs another package's Storybook.
  it('adds nothing when the plugin runs another Storybook', async () => {
    write({
      'packages/b/.storybook/main.mjs': '',
      'vitest.config.ts': `import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
export default { plugins: [storybookTest({ configDir: 'packages/a/.storybook' })] };`,
    });

    expect(await getImplicitAddons(join(root, 'packages/b/.storybook'))).toEqual([]);
  });

  it('adds nothing when the addon is not installed', async () => {
    rmSync(join(root, 'node_modules'), { recursive: true });
    write({ 'vite.config.ts': PLUGIN_CONFIG });

    expect(await getImplicitAddons(configDir())).toEqual([]);
  });

  it('adds nothing when build.test.disabledAddons turns it off', async () => {
    write({ 'vite.config.ts': PLUGIN_CONFIG });

    expect(
      await getImplicitAddons(configDir(), {
        test: { disabledAddons: ['@storybook/addon-vitest'] },
      })
    ).toEqual([]);
  });
});

describe('loadAllPresets', () => {
  it('loads the addon once when main does not list it', async () => {
    write({
      '.storybook/main.mjs': 'export default { addons: [] };',
      'vite.config.ts': PLUGIN_CONFIG,
    });

    expect(await loadAddonVitestCount()).toBe(1);
  });

  it('does not add it again when main lists it in a form addon names cannot read', async () => {
    write({
      '.storybook/main.mjs': `export default { addons: ['../node_modules/@storybook/addon-vitest'] };`,
      'vite.config.ts': PLUGIN_CONFIG,
    });

    expect(await loadAddonVitestCount()).toBe(1);
  });

  it('does not add it again when a preset of main lists it', async () => {
    write({
      '.storybook/main.mjs': `export default { addons: ['./shared-preset.mjs'] };`,
      '.storybook/shared-preset.mjs': `export const addons = ['@storybook/addon-vitest'];`,
      'vite.config.ts': PLUGIN_CONFIG,
    });

    expect(await loadAddonVitestCount()).toBe(1);
  });

  it('does not add it in the critical first pass', async () => {
    write({
      '.storybook/main.mjs': 'export default { addons: [] };',
      'vite.config.ts': PLUGIN_CONFIG,
    });

    expect(await loadAddonVitestCount(true)).toBe(0);
  });
});
