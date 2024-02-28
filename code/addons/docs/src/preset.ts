import fs from 'fs-extra';
import { dirname, join } from 'path';
import remarkSlug from 'remark-slug';
import remarkExternalLinks from 'remark-external-links';
import { dedent } from 'ts-dedent';

import type { DocsOptions, Indexer, Options, StorybookConfig } from '@storybook/types';
import type { CsfPluginOptions } from '@storybook/csf-plugin';
import type { JSXOptions, CompileOptions } from '@storybook/mdx2-csf';
import { global } from '@storybook/global';
import { loadCsf } from '@storybook/csf-tools';
import { logger } from '@storybook/node-logger';
import { ensureReactPeerDeps } from './ensure-react-peer-deps';

async function webpack(
  webpackConfig: any = {},
  options: Options & {
    /**
     * @deprecated
     * Use `jsxOptions` to customize options used by @babel/preset-react
     */
    configureJsx: boolean;
    /**
     * @deprecated
     * Use `jsxOptions` to customize options used by @babel/preset-react
     */
    mdxBabelOptions?: any;
    /** @deprecated */
    sourceLoaderOptions: any;
    csfPluginOptions: CsfPluginOptions | null;
    jsxOptions?: JSXOptions;
    mdxPluginOptions?: CompileOptions;
  } /* & Parameters<
      typeof createCompiler
    >[0] */
) {
  const { module = {} } = webpackConfig;

  // it will reuse babel options that are already in use in storybook
  // also, these babel options are chained with other presets.
  const {
    csfPluginOptions = {},
    jsxOptions = {},
    sourceLoaderOptions = null,
    configureJsx,
    mdxBabelOptions,
    mdxPluginOptions = {},
  } = options;

  const mdxLoaderOptions = await options.presets.apply<CompileOptions>('mdxLoaderOptions', {
    skipCsf: true,
    ...mdxPluginOptions,
    mdxCompileOptions: {
      providerImportSource: join(
        dirname(require.resolve('@storybook/addon-docs/package.json')),
        '/dist/shims/mdx-react-shim'
      ),
      ...mdxPluginOptions.mdxCompileOptions,
      remarkPlugins: [remarkSlug, remarkExternalLinks].concat(
        mdxPluginOptions?.mdxCompileOptions?.remarkPlugins ?? []
      ),
    },
    jsxOptions,
  });

  if (sourceLoaderOptions) {
    throw new Error(dedent`
      Addon-docs no longer uses source-loader in 7.0.

      To update your configuration, please see migration instructions here:

      https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#dropped-source-loader--storiesof-static-snippets
    `);
  }

  if (mdxBabelOptions || configureJsx) {
    throw new Error(dedent`
      Addon-docs no longer uses configureJsx or mdxBabelOptions in 7.0.

      To update your configuration, please see migration instructions here:

      https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#dropped-addon-docs-manual-babel-configuration
    `);
  }

  const mdxVersion = global.FEATURES?.legacyMdx1 ? 'MDX1' : 'MDX2';
  logger.info(`Addon-docs: using ${mdxVersion}`);

  const mdxLoader = global.FEATURES?.legacyMdx1
    ? require.resolve('@storybook/mdx1-csf/loader')
    : require.resolve('@storybook/mdx2-csf/loader');

  const result = {
    ...webpackConfig,
    plugins: [
      ...(webpackConfig.plugins || []),

      ...(csfPluginOptions
        ? [(await import('@storybook/csf-plugin')).webpack(csfPluginOptions)]
        : []),
    ],

    module: {
      ...module,
      rules: [
        ...(module.rules || []),
        {
          test: /(stories|story)\.mdx$/,
          use: [
            {
              loader: mdxLoader,
              options: {
                ...mdxLoaderOptions,
                skipCsf: false,
              },
            },
          ],
        },
        {
          test: /\.mdx$/,
          exclude: /(stories|story)\.mdx$/,
          use: [
            {
              loader: mdxLoader,
              options: mdxLoaderOptions,
            },
          ],
        },
      ],
    },
  };

  return result;
}

export const createStoriesMdxIndexer = (legacyMdx1?: boolean): Indexer => ({
  test: /(stories|story)\.mdx$/,
  createIndex: async (fileName, opts) => {
    let code = (await fs.readFile(fileName, 'utf-8')).toString();
    const { compile } = legacyMdx1
      ? await import('@storybook/mdx1-csf')
      : await import('@storybook/mdx2-csf');
    code = await compile(code, {});
    const csf = loadCsf(code, { ...opts, fileName }).parse();

    const { indexInputs, stories } = csf;

    return indexInputs.map((input, index) => {
      const docsOnly = stories[index].parameters?.docsOnly;
      const tags = input.tags ? input.tags : [];
      if (docsOnly) {
        tags.push('stories-mdx-docsOnly');
      }
      // the mdx-csf compiler automatically adds the 'stories-mdx' tag to meta, here' we're just making sure it is always there
      if (!tags.includes('stories-mdx')) {
        tags.push('stories-mdx');
      }
      return { ...input, tags };
    });
  },
});

const indexers: StorybookConfig['experimental_indexers'] = (existingIndexers) =>
  [createStoriesMdxIndexer(global.FEATURES?.legacyMdx1)].concat(existingIndexers || []);

const docs = (docsOptions: DocsOptions) => {
  return {
    ...docsOptions,
    defaultName: 'Docs',
    autodocs: 'tag',
  };
};

export const addons: StorybookConfig['addons'] = [
  require.resolve('@storybook/react-dom-shim/dist/preset'),
];

export const viteFinal = async (config: any, options: Options) => {
  const { plugins = [] } = config;
  const { mdxPlugin } = await import('./plugins/mdx-plugin');

  plugins.push(mdxPlugin(options));

  return config;
};

/*
 * This is a workaround for https://github.com/Swatinem/rollup-plugin-dts/issues/162
 * something down the dependency chain is using typescript namespaces, which are not supported by rollup-plugin-dts
 */
const webpackX = webpack as any;
const indexersX = indexers as any;
const docsX = docs as any;

ensureReactPeerDeps();

const optimizeViteDeps = [
  '@mdx-js/react',
  '@storybook/addon-docs > acorn-jsx',
  '@storybook/addon-docs',
  '@storybook/addon-essentials/docs/mdx-react-shim',
  'markdown-to-jsx',
];

export { webpackX as webpack, indexersX as experimental_indexers, docsX as docs, optimizeViteDeps };
