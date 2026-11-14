import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dirname, join } from 'pathe';

import { findStorybookVitestConfig } from './storybook-vitest-config.ts';

const WITH_PLUGIN = `import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
export default { test: { projects: [{ plugins: [storybookTest()] }] } };`;
const WITHOUT_PLUGIN = `export default { test: { projects: [{ test: { name: 'unit' } }] } };`;

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sb-vitest-config-'));
  // Storybook runs from the package root, so a plugin without `configDir` runs `<root>/.storybook`.
  vi.spyOn(process, 'cwd').mockReturnValue(root);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

function write(files: Record<string, string>) {
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
}

const find = (configDir: string) =>
  findStorybookVitestConfig({ configDir: join(root, configDir), projectRoot: root });

describe('findStorybookVitestConfig', () => {
  it('lets Vitest load the package config itself when it uses the plugin', () => {
    write({ '.storybook/main.ts': '', 'vitest.config.ts': WITH_PLUGIN });

    expect(find('.storybook')).toMatchObject({
      configFile: join(root, 'vitest.config.ts'),
      root,
      explicit: false,
      loads: join(root, 'vitest.config.ts'),
    });
  });

  // SB-2533 (lucca-front): the root config runs the unit tests only; the Storybook project lives
  // in a config of its own next to main.ts, which Vitest never loads by itself.
  it('finds a config inside the Storybook config dir and passes it explicitly', () => {
    write({
      '.storybook/main.ts': '',
      '.storybook/vitest.config.ts': WITH_PLUGIN,
      'vitest.config.ts': WITHOUT_PLUGIN,
    });

    expect(find('.storybook')).toMatchObject({
      configFile: join(root, '.storybook/vitest.config.ts'),
      root,
      explicit: true,
      loads: join(root, '.storybook/vitest.config.ts'),
      others: [join(root, 'vitest.config.ts')],
    });
  });

  it('finds a dedicated config such as vitest.storybook.config.ts', () => {
    write({
      '.storybook/main.ts': '',
      'vitest.config.ts': WITHOUT_PLUGIN,
      'vitest.storybook.config.mts': WITH_PLUGIN,
    });

    expect(find('.storybook')).toMatchObject({
      configFile: join(root, 'vitest.storybook.config.mts'),
      root,
      explicit: true,
    });
  });

  it('keeps the vitest.config Vitest picks over a vite.config with the plugin, and reports it', () => {
    write({
      '.storybook/main.ts': '',
      'vitest.config.ts': `import viteConfig from './vite.config';\nexport default viteConfig;`,
      'vite.config.ts': WITH_PLUGIN,
    });

    expect(find('.storybook')).toMatchObject({
      configFile: join(root, 'vite.config.ts'),
      explicit: false,
      loads: join(root, 'vitest.config.ts'),
    });
  });

  it('prefers the package of the Storybook over the monorepo root', () => {
    write({
      'vitest.config.ts': WITH_PLUGIN,
      'packages/ui/.storybook/main.ts': '',
      'packages/ui/vite.config.ts': WITH_PLUGIN,
    });

    expect(find('packages/ui/.storybook')).toMatchObject({
      configFile: join(root, 'packages/ui/vite.config.ts'),
      root: join(root, 'packages/ui'),
      explicit: false,
    });
  });

  it('walks up to a monorepo root config whose plugin names the package', () => {
    write({
      'vitest.config.ts': `import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
export default { plugins: [storybookTest({ configDir: './packages/ui/.storybook' })] };`,
      'packages/ui/.storybook/main.ts': '',
    });

    expect(find('packages/ui/.storybook')).toMatchObject({
      configFile: join(root, 'vitest.config.ts'),
      root,
      explicit: false,
    });
    expect(find('packages/ui/.storybook').loose).toBeUndefined();
  });

  // Review: every package of a monorepo has a `.storybook`, so the folder name alone is not enough
  // above the package root.
  it('takes a monorepo root config that runs another package only loosely', () => {
    write({
      'vitest.config.ts': `import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
export default { plugins: [storybookTest({ configDir: path.join(dirname, 'packages/a/.storybook') })] };`,
      'packages/b/.storybook/main.ts': '',
    });

    expect(find('packages/b/.storybook')).toMatchObject({
      configFile: join(root, 'vitest.config.ts'),
      loose: true,
    });
  });

  it('does not count a commented-out plugin or a mention of the addon', () => {
    write({
      '.storybook/main.ts': '',
      'vite.config.ts': `// storybookTest() from @storybook/addon-vitest was removed
/* plugins: [storybookTest()] */
export default { optimizeDeps: { include: ['@storybook/addon-vitest'] } };`,
    });

    expect(find('.storybook').configFile).toBeUndefined();
  });

  it("keeps Vitest's own choice of default config, and passes a .tsx config explicitly", () => {
    write({
      '.storybook/main.ts': '',
      'vitest.config.ts': WITHOUT_PLUGIN,
      'vitest.config.mts': WITH_PLUGIN,
      'lib/.storybook/main.ts': '',
      'lib/vite.config.tsx': WITH_PLUGIN,
    });

    // Vitest tries .ts before .mts, so it would load the config without the plugin.
    expect(find('.storybook')).toMatchObject({
      configFile: join(root, 'vitest.config.mts'),
      explicit: false,
      loads: join(root, 'vitest.config.ts'),
    });
    // Vitest never loads a .tsx config by itself.
    expect(find('lib/.storybook')).toMatchObject({
      configFile: join(root, 'lib/vite.config.tsx'),
      explicit: true,
    });
  });

  it('reports every place it looked when no config uses the plugin', () => {
    write({
      '.storybook/main.ts': '',
      '.storybook/vitest.config.ts': WITHOUT_PLUGIN,
      'vitest.config.ts': WITHOUT_PLUGIN,
    });

    expect(find('.storybook')).toEqual({
      explicit: false,
      searched: [root, join(root, '.storybook')],
      others: [join(root, 'vitest.config.ts'), join(root, '.storybook/vitest.config.ts')],
    });
  });

  // test-storybooks/mcp: one package, several Storybooks, and the plugin runs only `.storybook`.
  it('skips a config whose plugin runs another Storybook of the package', () => {
    write({
      '.storybook/main.ts': '',
      '.storybook-no-vitest/main.ts': '',
      'vitest.config.ts': `import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
export default { test: { projects: [{ plugins: [storybookTest({ configDir: path.join(dirname, '.storybook') })] }] } };`,
    });

    expect(find('.storybook').configFile).toBe(join(root, 'vitest.config.ts'));
    // Still good enough to start Vitest with, but not for this Storybook.
    expect(find('.storybook-no-vitest')).toMatchObject({
      configFile: join(root, 'vitest.config.ts'),
      loose: true,
      others: [join(root, 'vitest.config.ts')],
    });
  });

  it('finds a config whose plugin names a config dir of another name', () => {
    write({
      'storybook-ui/main.ts': '',
      'vitest.config.ts': `import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
export default { plugins: [storybookTest({ configDir: './storybook-ui' })] };`,
    });

    expect(find('storybook-ui').configFile).toBe(join(root, 'vitest.config.ts'));
  });

  it('does not take a plugin without configDir for a config dir of another name', () => {
    write({ 'storybook-ui/main.ts': '', 'vitest.config.ts': WITH_PLUGIN });

    expect(find('storybook-ui').loose).toBe(true);
  });

  // Review: a glob in a string must not open a block comment that swallows `configDir`.
  it('reads configDir past globs and URLs in strings', () => {
    write({
      '.storybook/main.ts': '',
      '.storybook-ui/main.ts': '',
      'vitest.config.ts': `import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
export default {
  test: {
    include: ['src/*.test.ts'],
    exclude: ['**/node_modules/**'],
    projects: [{ plugins: [storybookTest({ configDir: '.storybook-ui', storybookUrl: 'http://localhost:6006' })] }],
  },
};`,
    });

    expect(find('.storybook').loose).toBe(true);
    expect(find('.storybook-ui').loose).toBeUndefined();
  });

  it('takes a plugin without configDir only loosely when Storybook runs from another folder', () => {
    write({ 'packages/ui/.storybook/main.ts': '', 'packages/ui/vite.config.ts': WITH_PLUGIN });

    expect(find('packages/ui/.storybook')).toMatchObject({
      configFile: join(root, 'packages/ui/vite.config.ts'),
      loose: true,
    });
  });

  it('runs a dedicated config through the default config that composes it', () => {
    write({
      '.storybook/main.ts': '',
      'vitest.config.ts': `export default { test: { projects: ['./vitest.storybook.config.ts'] } };`,
      'vitest.storybook.config.ts': WITH_PLUGIN,
    });

    expect(find('.storybook')).toMatchObject({
      configFile: join(root, 'vitest.storybook.config.ts'),
      explicit: false,
      loads: join(root, 'vitest.config.ts'),
    });
  });

  it('does not look above the project root', () => {
    write({ 'vitest.config.ts': WITH_PLUGIN, 'app/.storybook/main.ts': '' });

    expect(
      findStorybookVitestConfig({
        configDir: join(root, 'app/.storybook'),
        projectRoot: join(root, 'app'),
      }).configFile
    ).toBeUndefined();
  });
});
