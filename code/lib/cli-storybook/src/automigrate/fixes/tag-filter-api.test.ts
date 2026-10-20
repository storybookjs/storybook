import * as fsp from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findConfigFile, formatExistingFile, JsPackageManager } from 'storybook/internal/common';

import { fs, vol } from 'memfs';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { tagFilterApi } from './tag-filter-api.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const configDir = resolve('.storybook');
const mainConfigPath = resolve('.storybook/main.ts');
const managerConfigPath = resolve('.storybook/manager.ts');
const storyPath = resolve('src/Button.stories.ts');
const options = {
  packageManager: vi.mocked(JsPackageManager.prototype),
  mainConfig: { stories: [] },
  mainConfigPath,
  configDir,
  storybookVersion: '11.0.0',
  storiesPaths: [storyPath],
};

describe('tag-filter-api', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(findConfigFile).mockReturnValue(managerConfigPath);
    vi.mocked(formatExistingFile).mockImplementation(async (_path, source) => source);
    vi.mocked(fsp.readFile).mockImplementation(fs.promises.readFile as typeof fsp.readFile);
    vi.mocked(fsp.writeFile).mockImplementation(fs.promises.writeFile as typeof fsp.writeFile);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies only when a config still uses a deprecated tag filter name', async () => {
    vol.fromJSON({
      [mainConfigPath]: 'export default { tags: { internal: { hideFromSidebar: true } } };',
      [managerConfigPath]: 'export {};',
      [storyPath]: 'export default {};',
    });
    await expect(checkFix(tagFilterApi, options)).resolves.toBeNull();
  });

  it('renames tag option keys and experimental_setFilter identifiers', async () => {
    vol.fromJSON({
      [mainConfigPath]:
        'export default { tags: { internal: { excludeFromSidebar: true, excludeFromDocsStories: true } } };',
      [managerConfigPath]:
        'api.experimental_setFilters({ internal: (item) => !item.tags?.includes("internal") });\napi.experimental_setFilter("other", () => true);',
      [storyPath]:
        'export const example = { play: async ({ api }) => api.experimental_setFilter("x", () => true) };',
    });

    const failures = await runFix(tagFilterApi, { ...options, result: {} });
    expect(failures).toEqual([]);
    expect(fs.readFileSync(mainConfigPath, 'utf8')).toContain('hideFromSidebar: true');
    expect(fs.readFileSync(mainConfigPath, 'utf8')).toContain('hideFromAutodocs: true');
    expect(fs.readFileSync(mainConfigPath, 'utf8')).not.toContain('excludeFrom');
    expect(fs.readFileSync(managerConfigPath, 'utf8')).toBe(
      'api.setFilters({ internal: (item) => !item.tags?.includes("internal") });\napi.setFilter("other", () => true);'
    );
    expect(fs.readFileSync(storyPath, 'utf8')).toContain('api.setFilter("x"');
    expect(fs.readFileSync(storyPath, 'utf8')).not.toContain('experimental_setFilter');
  });

  it('keeps string literals and longer identifiers', async () => {
    vol.fromJSON({
      [mainConfigPath]: 'export default { stories: [] };',
      [managerConfigPath]: 'export {};',
      [storyPath]: [
        "const title = 'API/experimental_setFilter';",
        'const experimental_setFilterExtra = true;',
        'api.experimental_setFilter("x", () => true);',
        "api['experimental_setFilters'](() => true);",
      ].join('\n'),
    });

    const failures = await runFix(tagFilterApi, { ...options, result: {} });
    expect(failures).toEqual([]);
    const story = fs.readFileSync(storyPath, 'utf8') as string;
    expect(story).toContain("const title = 'API/experimental_setFilter';");
    expect(story).toContain('const experimental_setFilterExtra = true;');
    expect(story).toContain('api.setFilter("x", () => true);');
    expect(story).toContain("api['experimental_setFilters'](() => true);");
  });

  it('renames member calls and destructuring, not object keys', async () => {
    vol.fromJSON({
      [mainConfigPath]: 'export default { stories: [] };',
      [managerConfigPath]: 'export {};',
      [storyPath]: [
        'const config = { experimental_setFilter: 1, setFilter: 2 };',
        'api.experimental_setFilter("x", () => true);',
        'api?.experimental_setFilters({});',
        'const { experimental_setFilter } = api;',
      ].join('\n'),
    });

    const failures = await runFix(tagFilterApi, { ...options, result: {} });
    expect(failures).toEqual([]);
    const story = fs.readFileSync(storyPath, 'utf8') as string;
    expect(story).toContain('const config = { experimental_setFilter: 1, setFilter: 2 };');
    expect(story).toContain('api.setFilter("x", () => true);');
    expect(story).toContain('api?.setFilters({});');
    expect(story).toContain('const { setFilter } = api;');
  });

  it('keeps a story hidden when only the deprecated alias is true', async () => {
    vol.fromJSON({
      [mainConfigPath]:
        'export default { tags: { internal: { hideFromSidebar: false, excludeFromSidebar: true, hideFromAutodocs: false, excludeFromDocsStories: true } } };',
      [managerConfigPath]: 'export {};',
      [storyPath]: 'export default {};',
    });

    const failures = await runFix(tagFilterApi, { ...options, result: {} });
    expect(failures).toEqual([]);
    const main = fs.readFileSync(mainConfigPath, 'utf8') as string;
    expect(main).toContain('hideFromSidebar: true');
    expect(main).toContain('hideFromAutodocs: true');
    expect(main).not.toContain('excludeFromSidebar');
    expect(main).not.toContain('excludeFromDocsStories');
  });

  it('renames an expression-valued option and leaves unrelated identifiers', async () => {
    vol.fromJSON({
      [mainConfigPath]: [
        'export default {',
        '  tags: {',
        "    internal: { excludeFromSidebar: options.configType === 'PRODUCTION' },",
        "    beta: { defaultFilterSelection: process.env.BETA ? 'include' : 'exclude' },",
        '  },',
        '};',
      ].join('\n'),
      [managerConfigPath]: 'export {};',
      [storyPath]: 'value.toString();\napi.experimental_setFilter("x", () => true);',
    });

    const failures = await runFix(tagFilterApi, { ...options, result: {} });
    expect(failures).toEqual([]);
    const main = fs.readFileSync(mainConfigPath, 'utf8') as string;
    expect(main).toContain("hideFromSidebar: options.configType === 'PRODUCTION'");
    expect(main).toContain("defaultFilterSelection: process.env.BETA ? 'include' : 'exclude'");
    expect(main).not.toContain('excludeFromSidebar');
    const story = fs.readFileSync(storyPath, 'utf8') as string;
    expect(story).toContain('value.toString();');
    expect(story).toContain('api.setFilter("x", () => true);');
  });

  it('drops a deprecated key when the new name is already set', async () => {
    vol.fromJSON({
      [mainConfigPath]:
        'export default { tags: { internal: { hideFromSidebar: true, excludeFromSidebar: true } } };',
      [managerConfigPath]: 'export {};',
      [storyPath]: 'export default {};',
    });

    const failures = await runFix(tagFilterApi, { ...options, result: {} });
    expect(failures).toEqual([]);
    const main = fs.readFileSync(mainConfigPath, 'utf8') as string;
    expect(main).toContain('hideFromSidebar: true');
    expect(main).not.toContain('excludeFromSidebar');
  });
});
