import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

// eslint-disable-next-line depend/ban-dependencies
import { globby } from 'globby';
import { vol } from 'memfs';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { addonThemesJsxProvider } from './addon-themes-jsx-provider.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('globby', { spy: true });

const mainConfigPath = '/project/.storybook/main.ts';
const previewConfigPath = '/project/.storybook/preview.ts';
const storyPath = '/project/src/Button.stories.tsx';
const decoratorPath = '/project/.storybook/decorator.ts';
const mdxPath = '/project/src/Button.mdx';
const vuePath = '/project/src/Button.stories.vue';

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

type ProjectFiles = {
  main?: string;
  preview?: string;
  story?: string;
  decorator?: string;
  mdx?: string;
  vue?: string;
};

const seed = (files: ProjectFiles) => {
  vol.fromJSON({
    [mainConfigPath]: files.main ?? "export default { addons: ['@storybook/addon-themes'] };\n",
    [previewConfigPath]:
      files.preview ?? "import { withThemeByClassName } from '@storybook/addon-themes';\n",
    [storyPath]: files.story ?? 'export default { title: "Button" };\n',
    ...(files.decorator ? { [decoratorPath]: files.decorator } : {}),
    ...(files.mdx !== undefined ? { [mdxPath]: files.mdx } : {}),
    ...(files.vue !== undefined ? { [vuePath]: files.vue } : {}),
  });
};

const projectOptions = (files: ProjectFiles, storybookVersion = '11.0.0') => ({
  ...options,
  storybookVersion,
  storiesPaths: [
    storyPath,
    ...(files.mdx !== undefined ? [mdxPath] : []),
    ...(files.vue !== undefined ? [vuePath] : []),
  ],
});

const check = (files: ProjectFiles, storybookVersion = '11.0.0') => {
  seed(files);
  return checkFix(addonThemesJsxProvider, projectOptions(files, storybookVersion));
};

const migrate = async (files: ProjectFiles, storybookVersion = '11.0.0') => {
  seed(files);
  const failures = await runFix(addonThemesJsxProvider, {
    ...projectOptions(files, storybookVersion),
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
  vi.mocked(globby).mockResolvedValue([]);
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
    vi.mocked(globby).mockResolvedValue([decoratorPath]);
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

  it('rewrites an MDX import the parser cannot read', async () => {
    const files = {
      mdx: `import { Meta } from '@storybook/addon-docs/blocks';\nimport { withThemeFromJSXProvider } from '@storybook/addon-themes';\nexport { ProviderStrategyConfiguration } from '@storybook/addon-themes';\n\n<Meta title="Button" />\n\n# Button\n`,
    };

    expect(await check(files)).toEqual({});
    await migrate(files);
    expect(vol.readFileSync(mdxPath, 'utf8')).toBe(
      `import { Meta } from '@storybook/addon-docs/blocks';\nimport { withThemeFromJSXProvider } from '@storybook/addon-themes-react';\nexport { ProviderStrategyConfiguration } from '@storybook/addon-themes-react';\n\n<Meta title="Button" />\n\n# Button\n`
    );
  });

  it('leaves a mixed import in a file that cannot be parsed and reports it', async () => {
    const line = `import { withThemeByClassName, withThemeFromJSXProvider } from '@storybook/addon-themes';`;
    const vue = `<script setup>\n${line}\n</script>\n\n<template><div /></template>\n`;
    const files = { vue };

    const result = await check(files);

    expect(result).toEqual({ mixedImportLines: [{ file: vuePath, line }] });
    expect(addonThemesJsxProvider.prompt(result!)).toContain(line);
    expect(addonThemesJsxProvider.prompt(result!)).toContain('Button.stories.vue');
    await migrate(files);
    expect(vol.readFileSync(vuePath, 'utf8')).toBe(vue);
  });

  it('rewrites dynamic import() destructuring the way require destructuring is rewritten', async () => {
    const files = {
      preview: `const { withThemeFromJSXProvider } = await import('@storybook/addon-themes');\nconst { withThemeByClassName, ProviderStrategyConfiguration } = await import('@storybook/addon-themes');\nimport('@storybook/addon-themes').then(({ withThemeFromJSXProvider }) => withThemeFromJSXProvider);\nimport('@storybook/addon-themes').then(({ withThemeByClassName, withThemeFromJSXProvider }) => withThemeByClassName);\n`,
    };

    const migrated = await migrate(files);

    expect(migrated.preview).toBe(
      `const { withThemeFromJSXProvider } = await import('@storybook/addon-themes-react');\nconst { withThemeByClassName } = await import('@storybook/addon-themes');\nconst { ProviderStrategyConfiguration } = await import('@storybook/addon-themes-react');\nimport('@storybook/addon-themes-react').then(({ withThemeFromJSXProvider }) => withThemeFromJSXProvider);\nimport('@storybook/addon-themes').then(({ withThemeByClassName, withThemeFromJSXProvider }) => withThemeByClassName);\n`
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
