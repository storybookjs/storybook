import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { vol } from 'memfs';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import type { CheckOptions } from '../types.ts';
import { addonThemesJsxProvider } from './addon-themes-jsx-provider.ts';

const { globby } = vi.hoisted(() => ({ globby: vi.fn(async () => [] as string[]) }));

vi.mock('node:fs/promises', { spy: true });
vi.mock('globby', () => ({ globby }));

const mainConfigPath = '/project/.storybook/main.ts';
const previewConfigPath = '/project/.storybook/preview.ts';
const storyPath = '/project/src/Button.stories.tsx';
const decoratorPath = '/project/.storybook/decorator.ts';

const packageManager = {
  addDependencies: vi.fn(),
} as unknown as JsPackageManager;

const options = {
  packageManager,
  configDir: '/project/.storybook',
  mainConfigPath,
  previewConfigPath,
  mainConfig: {} as StorybookConfigRaw,
  storiesPaths: [storyPath],
  storybookVersion: '11.0.0',
};

const seed = (files: { main?: string; preview?: string; story?: string; decorator?: string }) => {
  vol.fromJSON({
    [mainConfigPath]: files.main ?? "export default { addons: ['@storybook/addon-themes'] };\n",
    [previewConfigPath]:
      files.preview ?? "import { withThemeByClassName } from '@storybook/addon-themes';\n",
    [storyPath]: files.story ?? 'export default { title: "Button" };\n',
    ...(files.decorator ? { [decoratorPath]: files.decorator } : {}),
  });
};

const check = (files: Parameters<typeof seed>[0], storybookVersion = '11.0.0') => {
  seed(files);
  return checkFix(addonThemesJsxProvider, { ...options, storybookVersion } as CheckOptions);
};

const migrate = async (files: Parameters<typeof seed>[0], storybookVersion = '11.0.0') => {
  seed(files);
  const failures = await runFix(addonThemesJsxProvider, {
    ...options,
    result: {},
    storybookVersion,
  });
  if (failures.length > 0) {
    throw new Error(failures.map(({ message }) => message).join('\n'));
  }
  return {
    main: vol.readFileSync(mainConfigPath, 'utf8') as string,
    preview: vol.readFileSync(previewConfigPath, 'utf8') as string,
    story: vol.readFileSync(storyPath, 'utf8') as string,
    decorator: files.decorator ? (vol.readFileSync(decoratorPath, 'utf8') as string) : undefined,
  };
};

beforeEach(() => {
  vol.reset();
  vi.mocked(packageManager.addDependencies).mockClear();
  globby.mockResolvedValue([]);
  vi.mocked(readFile).mockImplementation(vol.promises.readFile as typeof readFile);
  vi.mocked(writeFile).mockImplementation(vol.promises.writeFile as typeof writeFile);
});

describe('addon-themes-jsx-provider', () => {
  it('rewrites a named import and adds the devDependency without registering the package', async () => {
    const files = {
      main: "export default { addons: ['@storybook/addon-themes'] };\n",
      preview:
        "import { withThemeFromJSXProvider } from '@storybook/addon-themes';\nexport const decorators = [];\n",
    };

    expect(await check(files)).toEqual({});
    expect(await migrate(files)).toEqual({
      main: files.main,
      preview:
        "import { withThemeFromJSXProvider } from '@storybook/addon-themes-react';\nexport const decorators = [];\n",
      story: 'export default { title: "Button" };\n',
      decorator: undefined,
    });
    expect(packageManager.addDependencies).toHaveBeenCalledWith(
      { type: 'devDependencies', skipInstall: true },
      ['@storybook/addon-themes-react@11.0.0']
    );
  });

  it('leaves an import that already comes from the React package', async () => {
    const files = {
      preview: `import { withThemeFromJSXProvider } from '@storybook/addon-themes-react';\n`,
      story: `import { withThemeByClassName } from '@storybook/addon-themes';\nimport { withThemeFromJSXProvider } from '@storybook/addon-themes-react';\n`,
    };

    expect(await check(files)).toBeNull();
  });

  it('keeps class, data-attribute, and helper imports on the addon', async () => {
    const files = {
      preview: `
        import { withThemeByClassName, withThemeByDataAttribute, DecoratorHelpers } from '@storybook/addon-themes';
        import addonThemes from '@storybook/addon-themes';
        addonThemes.withThemeFromJSXProvider({});
      `,
      story: "import * as themesAnnotations from '@storybook/addon-themes/preview';\n",
    };

    expect(await check(files)).toBeNull();
  });

  it('splits a mixed import and preserves aliases', async () => {
    const files = {
      preview: `import { withThemeByClassName, withThemeFromJSXProvider as withTheme, type ProviderStrategyConfiguration } from "@storybook/addon-themes";\n`,
      story: `export { withThemeByDataAttribute, withThemeFromJSXProvider } from '@storybook/addon-themes';\nexport type { ProviderStrategyConfiguration as ProviderConfig } from '@storybook/addon-themes';\n`,
    };

    const migrated = await migrate(files);

    expect(migrated.preview).toBe(
      `import { withThemeByClassName } from "@storybook/addon-themes";\nimport { withThemeFromJSXProvider as withTheme, type ProviderStrategyConfiguration } from "@storybook/addon-themes-react";\n`
    );
    expect(migrated.story).toBe(
      `export { withThemeByDataAttribute } from '@storybook/addon-themes';\nexport { withThemeFromJSXProvider } from '@storybook/addon-themes-react';\nexport type { ProviderStrategyConfiguration as ProviderConfig } from '@storybook/addon-themes-react';\n`
    );
  });

  it('rewrites require destructuring and typeof import() of the moved names', async () => {
    const files = {
      preview: `const { withThemeByClassName, withThemeFromJSXProvider } = require('@storybook/addon-themes');\n`,
      story: `type Provider = import('@storybook/addon-themes').ProviderStrategyConfiguration;\ntype ClassConfig = import('@storybook/addon-themes').DecoratorHelpers;\n`,
    };

    const migrated = await migrate(files);

    expect(migrated.preview).toBe(
      `const { withThemeByClassName } = require('@storybook/addon-themes');\nconst { withThemeFromJSXProvider } = require('@storybook/addon-themes-react');\n`
    );
    expect(migrated.story).toBe(
      `type Provider = import('@storybook/addon-themes-react').ProviderStrategyConfiguration;\ntype ClassConfig = import('@storybook/addon-themes').DecoratorHelpers;\n`
    );
  });

  it('rewrites a config-directory file found beside main and preview', async () => {
    globby.mockResolvedValue([decoratorPath]);
    const files = {
      decorator: `import { withThemeFromJSXProvider } from '@storybook/addon-themes';\n`,
    };

    expect((await migrate(files)).decorator).toBe(
      `import { withThemeFromJSXProvider } from '@storybook/addon-themes-react';\n`
    );
  });

  it.each(['11.0.0-alpha.1', '11.0.0', '11.1.0'])('applies on Storybook %s', async (version) => {
    const files = {
      preview: `import { withThemeFromJSXProvider } from '@storybook/addon-themes';\n`,
    };

    expect(await check(files, version)).toEqual({});
    await migrate(files, version);
    expect(packageManager.addDependencies).toHaveBeenCalledWith(
      { type: 'devDependencies', skipInstall: true },
      [`@storybook/addon-themes-react@${version}`]
    );
  });

  it('does not apply on Storybook 10, where the decorator is still exported', async () => {
    expect(
      await check(
        { preview: `import { withThemeFromJSXProvider } from '@storybook/addon-themes';\n` },
        '10.6.0'
      )
    ).toBeNull();
  });
});
