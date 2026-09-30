import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findConfigFile } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { fs as memfsFs, vol } from 'memfs';

import { checkFix } from '../helpers/fix-test-utils.ts';
import { makePackageManager } from '../helpers/testing-helpers.ts';
import { sidebarFilters } from './sidebar-filters.ts';

vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });

const configDir = resolve('.storybook');
const managerConfigPath = resolve('.storybook/manager.ts');
const mainConfig = { stories: [] } as StorybookConfigRaw;

const check = () =>
  checkFix(sidebarFilters, {
    packageManager: makePackageManager({}),
    configDir,
    mainConfigPath: resolve('.storybook/main.ts'),
    mainConfig,
    storybookVersion: '11.0.0',
    storiesPaths: [],
  });

describe('sidebar-filters', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(fs.existsSync).mockImplementation(memfsFs.existsSync as typeof fs.existsSync);
    vi.mocked(fsp.readFile).mockImplementation(memfsFs.promises.readFile as typeof fsp.readFile);
  });

  it('notifies when manager setConfig registers sidebar.filters', async () => {
    vol.fromJSON({
      [managerConfigPath]: `
        import { addons } from 'storybook/manager-api';
        addons.setConfig({ sidebar: { filters: { internal: (item) => !item.tags?.includes('internal') } } });
      `,
    });
    expect(findConfigFile('manager', configDir)).toBe(managerConfigPath);
    await expect(check()).resolves.toEqual({});
  });

  it('stays quiet when the manager has no sidebar filters', async () => {
    vol.fromJSON({
      [managerConfigPath]: `
        import { addons } from 'storybook/manager-api';
        addons.setConfig({ sidebar: { showRoots: true } });
      `,
    });
    await expect(check()).resolves.toBeNull();
  });
});
