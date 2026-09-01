// This file has been automatically migrated to valid ESM format by Storybook.
import { createRequire } from 'node:module';
import { dirname, join } from 'path';

import { StorybookConfig } from '@storybook/angular';
import remarkGfm from 'remark-gfm';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';

const require = createRequire(import.meta.url);

const config: StorybookConfig = {
  stories: [
    '../libs/storybook/src/**/*.mdx',
    '../libs/storybook/src/**/*.stories.@(js|jsx|ts|tsx)',
    '../libs/auth/src/**/*.mdx',
    '../libs/auth/src/**/*.stories.@(js|jsx|ts|tsx)',
    '../libs/dirt/card/src/**/*.mdx',
    '../libs/dirt/card/src/**/*.stories.@(js|jsx|ts|tsx)',
    '../libs/pricing/src/**/*.mdx',
    '../libs/pricing/src/**/*.stories.@(js|jsx|ts|tsx)',
    '../libs/subscription/src/**/*.mdx',
    '../libs/subscription/src/**/*.stories.@(js|jsx|ts|tsx)',
    '../libs/tools/send/send-ui/src/**/*.mdx',
    '../libs/tools/send/send-ui/src/**/*.stories.@(js|jsx|ts|tsx)',
    '../libs/vault/src/**/*.mdx',
    '../libs/vault/src/**/*.stories.@(js|jsx|ts|tsx)',
    '../libs/components/src/**/*.mdx',
    '../libs/components/src/**/*.stories.@(js|jsx|ts|tsx)',
    '../apps/web/src/**/*.mdx',
    '../apps/web/src/**/*.stories.@(js|jsx|ts|tsx)',
    '../apps/browser/src/**/*.mdx',
    '../apps/browser/src/**/*.stories.@(js|jsx|ts|tsx)',
    '../bitwarden_license/bit-web/src/**/*.mdx',
    '../bitwarden_license/bit-web/src/**/*.stories.@(js|jsx|ts|tsx)',
    '../bitwarden_license/bit-browser/src/**/*.mdx',
    '../bitwarden_license/bit-browser/src/**/*.stories.@(js|jsx|ts|tsx)',
    '../libs/angular/src/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: [
    getAbsolutePath('@storybook/addon-links'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-designs'),
    getAbsolutePath('@storybook/addon-themes'),
    {
      // @storybook/addon-docs is part of @storybook/addon-essentials

      name: getAbsolutePath('@storybook/addon-docs'),
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: {
            remarkPlugins: [remarkGfm],
          },
        },
      },
    },
    getAbsolutePath('@storybook/addon-mcp'),
  ],
  framework: {
    name: getAbsolutePath('@storybook/angular'),
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  env: (config) => ({
    ...config,
    FLAGS: JSON.stringify({}),
  }),
  webpackFinal: async (config, { configType }) => {
    if (config.resolve) {
      config.resolve.plugins = [new TsconfigPathsPlugin()] as any;
      config.resolve.fallback = {
        ...config.resolve.fallback,
        path: require.resolve('path-browserify'),
      };
    }
    return config;
  },
  docs: {},
  staticDirs: [
    '../apps/web/src/images',
    // Component templates reference images via relative paths like `../../../images/foo.png`,
    // which the browser resolves against the iframe's root URL as `/images/foo.png`. The entry
    // above only serves these files at the root (e.g. `/foo.png`), so this second entry mirrors
    // the same directory under `/images` too.
    { from: '../apps/web/src/images', to: '/images' },
  ],
  refs: (config, { configType }) => {
    if (configType === 'PRODUCTION') {
      const autofillUrl = process.env.AUTOFILL_CHROMATIC_URL;

      return {
        autofill: {
          /**
           * If we don't have a chromatic URL for the current branch's build, default to `main`
           * and include it in the sidebar title to notify users that they're not looking at the
           * current branch's stories
           */
          title: `Autofill Components ${autofillUrl ? '' : '(main)'}`,
          url: autofillUrl ?? 'https://main--695ffc4bef53d3a5ae4c8067.chromatic.com',
        },
      };
    }

    // Only use storybook composition if we're running the script for both storybooks
    if (process.env.STORYBOOK_DEV === 'combined') {
      return {
        autofill: {
          title: 'Autofill Components',
          url: 'http://localhost:6007',
        },
      };
    }

    return {
      autofill: {
        disable: true,
      },
    };
  },
};

export default config;

// Recommended for mono-repositories
function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, 'package.json')));
}
