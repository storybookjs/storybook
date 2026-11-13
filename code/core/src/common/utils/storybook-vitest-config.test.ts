import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { dirname, join } from 'pathe';

import { findStorybookVitestConfig } from './storybook-vitest-config.ts';

const WITH_PLUGIN = `import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
export default { test: { projects: [{ plugins: [storybookTest()] }] } };`;
const WITHOUT_PLUGIN = `export default { test: { projects: [{ test: { name: 'unit' } }] } };`;

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sb-vitest-config-'));
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

  it('walks up to a monorepo root config that uses the plugin', () => {
    write({ 'vitest.config.ts': WITH_PLUGIN, 'packages/ui/.storybook/main.ts': '' });

    expect(find('packages/ui/.storybook')).toMatchObject({
      configFile: join(root, 'vitest.config.ts'),
      root,
      explicit: false,
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
