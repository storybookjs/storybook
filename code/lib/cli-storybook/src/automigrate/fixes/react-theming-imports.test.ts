import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatExistingFile, JsPackageManager } from 'storybook/internal/common';

import { fs, vol } from 'memfs';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { reactThemingImports, rewriteReactThemingImports } from './react-theming-imports.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const previewConfigPath = resolve('.storybook/preview.tsx');
const storyPath = resolve('src/Button.stories.tsx');
const options = {
  packageManager: vi.mocked(JsPackageManager.prototype),
  mainConfig: { stories: [], framework: '@storybook/react-vite' },
  mainConfigPath: resolve('.storybook/main.ts'),
  configDir: resolve('.storybook'),
  storybookVersion: '11.0.0',
  previewConfigPath,
  storiesPaths: [storyPath],
};

describe('rewriteReactThemingImports', () => {
  const target = '@storybook/react-vite';

  it('points storybook/theming at the framework theming entry and keeps the quote style', () => {
    expect(
      rewriteReactThemingImports(
        `import { ThemeProvider, themes } from 'storybook/theming';\nimport { create } from "storybook/theming/create";`,
        target
      )
    ).toBe(
      `import { ThemeProvider, themes } from '@storybook/react-vite/theming';\nimport { create } from "storybook/theming/create";`
    );
  });

  it('moves withThemeFromJSXProvider to the framework and leaves the other addon decorators', () => {
    expect(
      rewriteReactThemingImports(
        `import addonThemes, { withThemeByClassName, withThemeFromJSXProvider, type ProviderStrategyConfiguration } from '@storybook/addon-themes';`,
        target
      )
    ).toBe(
      [
        `import addonThemes, { withThemeByClassName } from '@storybook/addon-themes';`,
        `import { withThemeFromJSXProvider, type ProviderStrategyConfiguration } from '@storybook/react-vite';`,
      ].join('\n')
    );
  });

  it('retargets an addon import that only has moved specifiers', () => {
    expect(
      rewriteReactThemingImports(
        `import type { ProviderStrategyConfiguration } from '@storybook/addon-themes';`,
        target
      )
    ).toBe(`import type { ProviderStrategyConfiguration } from '@storybook/react-vite';`);
  });

  it('leaves files that render Storybook UI blocks on storybook/theming', () => {
    const code = [
      `import { ArgsTable } from '@storybook/addon-docs/blocks';`,
      `import { ThemeProvider } from 'storybook/theming';`,
    ].join('\n');

    expect(rewriteReactThemingImports(code, target)).toBeNull();
  });

  it('returns null when nothing needs to move', () => {
    expect(
      rewriteReactThemingImports(
        `import { withThemeByDataAttribute } from '@storybook/addon-themes';`,
        target
      )
    ).toBeNull();
  });
});

describe('react-theming-imports', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vi.mocked(formatExistingFile).mockImplementation(async (_path, source) => source);
  });

  afterEach(() => {
    vi.mocked(readFile).mockRestore();
    vi.mocked(writeFile).mockRestore();
  });

  it('does not apply to non-React projects', async () => {
    vol.fromJSON({
      [previewConfigPath]: `import { themes } from 'storybook/theming';\nexport default {};`,
      [storyPath]: 'export default {};',
    });

    expect(
      await checkFix(reactThemingImports, {
        ...options,
        mainConfig: { stories: [], framework: '@storybook/vue3-vite' },
      })
    ).toBeNull();
  });

  it('does not apply when no preview or story file imports the moved modules', async () => {
    vol.fromJSON({
      [previewConfigPath]: `import { create } from 'storybook/theming/create';\nexport default {};`,
      [storyPath]: 'export default {};',
    });

    expect(await checkFix(reactThemingImports, options)).toBeNull();
  });

  it('falls back to @storybook/react for React frameworks without a theming entry', async () => {
    vol.fromJSON({
      [previewConfigPath]: `import { themes } from 'storybook/theming';\nexport default {};`,
      [storyPath]: 'export default {};',
    });

    expect(
      await checkFix(reactThemingImports, {
        ...options,
        mainConfig: { stories: [], framework: 'storybook-react-rsbuild' },
      })
    ).toEqual({ target: '@storybook/react' });
  });

  it('rewrites the preview and story files but not the manager', async () => {
    const managerPath = resolve('.storybook/manager.ts');
    const manager = `import { addons } from 'storybook/manager-api';\nimport { themes } from 'storybook/theming';\naddons.setConfig({ theme: themes.dark });`;
    vol.fromJSON({
      [previewConfigPath]: [
        `import { withThemeFromJSXProvider } from '@storybook/addon-themes';`,
        `import { ThemeProvider, themes } from 'storybook/theming';`,
        `export default { decorators: [withThemeFromJSXProvider({ Provider: ThemeProvider, themes })] };`,
      ].join('\n'),
      [managerPath]: manager,
      [storyPath]: `import { themes } from 'storybook/theming';\nexport default { parameters: { docs: { theme: themes.dark } } };`,
    });

    const failures = await runFix(reactThemingImports, {
      ...options,
      result: { target: '@storybook/react-vite' },
    });

    expect(failures).toEqual([]);
    expect(fs.readFileSync(previewConfigPath, 'utf8')).toBe(
      [
        `import { withThemeFromJSXProvider } from '@storybook/react-vite';`,
        `import { ThemeProvider, themes } from '@storybook/react-vite/theming';`,
        `export default { decorators: [withThemeFromJSXProvider({ Provider: ThemeProvider, themes })] };`,
      ].join('\n')
    );
    expect(fs.readFileSync(storyPath, 'utf8')).toBe(
      `import { themes } from '@storybook/react-vite/theming';\nexport default { parameters: { docs: { theme: themes.dark } } };`
    );
    expect(fs.readFileSync(managerPath, 'utf8')).toBe(manager);
  });
});
