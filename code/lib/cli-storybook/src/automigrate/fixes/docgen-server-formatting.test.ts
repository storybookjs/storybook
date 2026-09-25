import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JsPackageManager } from 'storybook/internal/common';

import { vol } from 'memfs';

import type { CheckOptions } from '../types.ts';
import { docgenServer } from './docgen-server.ts';

vi.mock('node:fs/promises', { spy: true });

const mainConfigPath = resolve('/project/.storybook/main.ts');
const advancedChatMainConfigPath = resolve(
  __dirname,
  '__fixtures__',
  'docgen-server',
  'advanced-chat',
  '.storybook',
  'main.ts'
);
const advancedChatSource = `import type { StorybookConfig } from '@storybook/vue3-vite'
import { mergeConfig } from 'vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)', '../docs/**/*.mdx'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-mcp',
    '@storybook/addon-vitest',
  ],
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: {
        plugin: 'vue-component-meta',
        tsconfig: 'tsconfig.lib.json',
      },
    },
  },
  managerHead: (head) =>
    \`${'${'}head ?? ''}\\n<script>document.title = 'Advanced Chat Components'</script>\`,
  viteFinal: async (config) =>
    mergeConfig(config, {
      // Honored by GitHub Pages deploy where the site lives under
      // \`/advanced-chat-components/\`. Default keeps local dev at \`/\`.
      base: process.env.STORYBOOK_BASE_URL ?? '/',
      build: {
        // Storybook docs bundles vendor-heavy preview assets that exceed Vite's
        // default generic warning threshold without indicating a product build issue.
        chunkSizeWarningLimit: 1200,
      },
    }),
}
export default config
`;
const dreiMainConfigPath = resolve(
  __dirname,
  '__fixtures__',
  'docgen-server',
  'drei',
  '.storybook',
  'main.ts'
);
const dreiSource = `import type { StorybookConfig } from '@storybook/react-vite'
import { svg } from './favicon.ts'

const config: StorybookConfig = {
  staticDirs: ['./public'],
  stories: ['./stories/**/*.stories.{ts,tsx}'],
  addons: ['@chromatic-com/storybook', '@storybook/addon-docs'],

  // Favicon (inline svg https://stackoverflow.com/questions/66935329/use-inline-svg-as-favicon)
  managerHead: (head) => \`
    ${'${'}head}
    <link rel="icon" href="data:image/svg+xml,${'${'}encodeURIComponent(
      svg(process.env.NODE_ENV === 'development' ? 'development' : undefined)
    )}">
  \`,

  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  docs: {},

  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      propFilter: (prop, component) => {
        // Only include props that belong to the current component
        const fileName = prop.declarations?.at(0)?.fileName // 'drei/src/core/AccumulativeShadows.tsx'
        const componentName = fileName?.split('/').at(-1)?.split('.').at(0) // 'AccumulativeShadows'
        return component.name === componentName
      },
    },
  },
}

export default config
`;
const checkOptions: CheckOptions = {
  mainConfigPath,
  mainConfig: { framework: '@storybook/react-vite', stories: [] },
  packageManager: JsPackageManager.prototype,
  storybookVersion: '11.0.0-alpha.1',
  beforeVersion: '10.6.0',
  storiesPaths: [],
  hasCsfFactoryPreview: false,
};

async function migrateRepositoryConfig(
  configPath: string,
  input: string,
  prettierConfigPath: string,
  prettierConfig: string,
  mainConfig: CheckOptions['mainConfig']
): Promise<string> {
  vol.fromJSON({ [configPath]: input, [prettierConfigPath]: prettierConfig });
  const options = { ...checkOptions, mainConfigPath: configPath, mainConfig };
  const result = await docgenServer.check(options);
  if (!result || !docgenServer.run) {
    throw new Error('Expected a runnable migration');
  }

  await docgenServer.run({
    ...options,
    configDir: resolve(configPath, '..'),
    result,
  });

  return vol.readFileSync(configPath, 'utf8') as string;
}

beforeEach(() => {
  vol.reset();
  vi.mocked(readFile).mockImplementation(vol.promises.readFile as typeof readFile);
  vi.mocked(writeFile).mockImplementation(vol.promises.writeFile as typeof writeFile);
});

afterEach(() => {
  vi.mocked(readFile).mockReset();
  vi.mocked(writeFile).mockReset();
});

describe('docgen-server formatting', () => {
  it('keeps the Advanced Chat main config Prettier-clean', async () => {
    const transformed = await migrateRepositoryConfig(
      advancedChatMainConfigPath,
      advancedChatSource,
      resolve(advancedChatMainConfigPath, '../..', '.prettierrc.json'),
      '{ "semi": false, "singleQuote": true, "printWidth": 100 }',
      { framework: '@storybook/vue3-vite', stories: [] }
    );
    const prettier = await import('prettier');
    const prettierOptions = await prettier.resolveConfig(advancedChatMainConfigPath);

    expect(
      await prettier.check(transformed, {
        ...prettierOptions,
        filepath: advancedChatMainConfigPath,
      })
    ).toBe(true);
    expect(transformed).toMatchInlineSnapshot(`
      "import type { StorybookConfig } from '@storybook/vue3-vite'
      import { mergeConfig } from 'vite'

      const config: StorybookConfig = {
        stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)', '../docs/**/*.mdx'],

        addons: [
          '@chromatic-com/storybook',
          '@storybook/addon-docs',
          '@storybook/addon-a11y',
          '@storybook/addon-mcp',
          '@storybook/addon-vitest',
        ],

        framework: {
          name: '@storybook/vue3-vite',
          options: {
            docgen: {
              plugin: 'vue-component-meta',
              tsconfig: 'tsconfig.lib.json',
            },
          },
        },

        managerHead: (head) =>
          \`\${head ?? ''}\\n<script>document.title = 'Advanced Chat Components'</script>\`,

        viteFinal: async (config) =>
          mergeConfig(config, {
            // Honored by GitHub Pages deploy where the site lives under
            // \`/advanced-chat-components/\`. Default keeps local dev at \`/\`.
            base: process.env.STORYBOOK_BASE_URL ?? '/',
            build: {
              // Storybook docs bundles vendor-heavy preview assets that exceed Vite's
              // default generic warning threshold without indicating a product build issue.
              chunkSizeWarningLimit: 1200,
            },
          }),

        features: {
          docgenServer: false,
        },
      }
      export default config
      "
    `);
  });

  it('keeps the Drei main config Prettier-clean', async () => {
    const transformed = await migrateRepositoryConfig(
      dreiMainConfigPath,
      dreiSource,
      resolve(dreiMainConfigPath, '../..', '.prettierrc'),
      '{ "semi": false, "trailingComma": "es5", "singleQuote": true, "tabWidth": 2, "printWidth": 120, "useTabs": false, "endOfLine": "auto" }',
      { framework: '@storybook/react-vite', stories: [] }
    );
    const prettier = await import('prettier');
    const prettierOptions = await prettier.resolveConfig(dreiMainConfigPath);

    expect(
      await prettier.check(transformed, { ...prettierOptions, filepath: dreiMainConfigPath })
    ).toBe(true);
    expect(transformed).toMatchInlineSnapshot(`
      "import type { StorybookConfig } from '@storybook/react-vite'
      import { svg } from './favicon.ts'

      const config: StorybookConfig = {
        staticDirs: ['./public'],
        stories: ['./stories/**/*.stories.{ts,tsx}'],
        addons: ['@chromatic-com/storybook', '@storybook/addon-docs'],

        // Favicon (inline svg https://stackoverflow.com/questions/66935329/use-inline-svg-as-favicon)
        managerHead: (head) => \`
          \${head}
          <link rel="icon" href="data:image/svg+xml,\${encodeURIComponent(
            svg(process.env.NODE_ENV === 'development' ? 'development' : undefined)
          )}">
        \`,

        framework: {
          name: '@storybook/react-vite',
          options: {},
        },

        docs: {},

        typescript: {
          reactDocgen: 'react-docgen-typescript',
          reactDocgenTypescriptOptions: {
            propFilter: (prop, component) => {
              // Only include props that belong to the current component
              const fileName = prop.declarations?.at(0)?.fileName // 'drei/src/core/AccumulativeShadows.tsx'
              const componentName = fileName?.split('/').at(-1)?.split('.').at(0) // 'AccumulativeShadows'
              return component.name === componentName
            },
          },
        },

        features: {
          docgenServer: false,
        },
      }

      export default config
      "
    `);
  });
});
