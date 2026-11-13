import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dirname, join } from 'pathe';

import { getImplicitAddons } from './presets.ts';
import { loadMainConfig } from './utils/load-main-config.ts';

vi.mock('./utils/load-main-config.ts', () => ({ loadMainConfig: vi.fn() }));

let root: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'sb-implicit-addons-')));
  write({
    'node_modules/@storybook/addon-vitest/package.json': JSON.stringify({
      name: '@storybook/addon-vitest',
      type: 'module',
      exports: { './preset': './preset.js', './manager': './manager.js' },
    }),
    'node_modules/@storybook/addon-vitest/preset.js': 'export const isAddonVitestEnabled = true;',
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

const main = (addons: string[]) =>
  vi.mocked(loadMainConfig).mockResolvedValue({ stories: [], addons });
const PLUGIN_CONFIG = `import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
export default { test: { projects: [{ plugins: [storybookTest()] }] } };`;

describe('getImplicitAddons', () => {
  // SB-2534 (GitButler): the project runs its story tests through the plugin in vite.config.ts,
  // and main.ts lists only addon-docs and addon-links.
  it('enables addon-vitest when a Vitest config uses its plugin but main does not list it', async () => {
    main(['@storybook/addon-docs']);
    write({ 'vite.config.ts': PLUGIN_CONFIG });

    expect(await getImplicitAddons(join(root, '.storybook'))).toEqual([
      expect.objectContaining({
        type: 'virtual',
        name: '@storybook/addon-vitest',
        presets: [{ name: join(root, 'node_modules/@storybook/addon-vitest/preset.js') }],
      }),
    ]);
  });

  it('adds nothing when main lists the addon, however it is written', async () => {
    main([join(root, 'node_modules/@storybook/addon-vitest')]);
    write({ 'vite.config.ts': PLUGIN_CONFIG });

    expect(await getImplicitAddons(join(root, '.storybook'))).toEqual([]);
  });

  it('adds nothing when no Vitest config uses the plugin', async () => {
    main([]);
    write({ 'vite.config.ts': 'export default {};' });

    expect(await getImplicitAddons(join(root, '.storybook'))).toEqual([]);
  });

  it('adds nothing when the addon is not installed', async () => {
    rmSync(join(root, 'node_modules'), { recursive: true });
    main([]);
    write({ 'vite.config.ts': PLUGIN_CONFIG });

    expect(await getImplicitAddons(join(root, '.storybook'))).toEqual([]);
  });
});
