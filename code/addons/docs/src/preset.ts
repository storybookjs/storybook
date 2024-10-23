import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { logger } from 'storybook/internal/node-logger';
import type { DocsOptions, Options, PresetProperty } from 'storybook/internal/types';

import type { CsfPluginOptions } from '@storybook/csf-plugin';

import rehypeExternalLinks from 'rehype-external-links';
import rehypeSlug from 'rehype-slug';

import type { CompileOptions } from './compiler';

/**
 * Get the resolvedReact preset, which points either to the user's react dependencies or the react
 * dependencies shipped with addon-docs if the user has not installed react explicitly.
 */
const getResolvedReact = async (options: Options) => {
  const resolvedReact = (await options.presets.apply('resolvedReact', {})) as any;
  // resolvedReact should always be set by the time we get here, but just in case, we'll default to addon-docs's react dependencies
  return {
    react: resolvedReact.react ?? dirname(fileURLToPath(import.meta.resolve('react/package.json'))),
    reactDom:
      resolvedReact.reactDom ??
      dirname(fileURLToPath(import.meta.resolve('react-dom/package.json'))),
    // In Webpack, symlinked MDX files will cause @mdx-js/react to not be resolvable if it is not hoisted
    // This happens for the SB monorepo's template stories when a sandbox has a different react version than
    // addon-docs, causing addon-docs's dependencies not to be hoisted.
    // This might also affect regular users who have a similar setup.
    // Explicitly alias @mdx-js/react to avoid this issue.
    mdx: resolvedReact.mdx ?? dirname(fileURLToPath(import.meta.resolve('@mdx-js/react'))),
  };
};

async function webpack(
  webpackConfig: any = {},
  options: Options & {
    csfPluginOptions: CsfPluginOptions | null;
    mdxPluginOptions?: CompileOptions;
  } /* & Parameters<
      typeof createCompiler
    >[0] */
) {
  const { module = {} } = webpackConfig;

  const { csfPluginOptions = {}, mdxPluginOptions = {} } = options;

  const mdxLoaderOptions: CompileOptions = await options.presets.apply('mdxLoaderOptions', {
    ...mdxPluginOptions,
    mdxCompileOptions: {
      providerImportSource: fileURLToPath(
        import.meta.resolve('@storybook/addon-docs/mdx-react-shim')
      ),
      ...mdxPluginOptions.mdxCompileOptions,
      rehypePlugins: [
        ...(mdxPluginOptions?.mdxCompileOptions?.rehypePlugins ?? []),
        rehypeSlug,
        rehypeExternalLinks,
      ],
    },
  });

  logger.info(`Addon-docs: using MDX3`);

  // Use the resolvedReact preset to alias react and react-dom to either the users version or the version shipped with addon-docs
  const { react, reactDom, mdx } = await getResolvedReact(options);

  let alias;

  /**
   * Add aliases for `@storybook/addon-docs` & `@storybook/blocks` These must be singletons to avoid
   * multiple instances of react & emotion being loaded, both would cause the components to fail to
   * render.
   *
   * In the future the `@storybook/theming` and `@storybook/components` can be removed, as they
   * should be singletons in the future due to the peerDependency on `storybook` package.
   */
  const cliPath = dirname(fileURLToPath(import.meta.resolve('storybook/package.json')));
  const themingPath = join(cliPath, 'core', 'theming', 'index.js');
  const themingCreatePath = join(cliPath, 'core', 'theming', 'create.js');

  const componentsPath = join(cliPath, 'core', 'components', 'index.js');
  const blocksPath = dirname(fileURLToPath(import.meta.resolve('@storybook/blocks/package.json')));
  if (Array.isArray(webpackConfig.resolve?.alias)) {
    alias = [...webpackConfig.resolve?.alias];
    alias.push(
      {
        name: 'react',
        alias: react,
      },
      {
        name: 'react-dom',
        alias: reactDom,
      },
      {
        name: '@mdx-js/react',
        alias: mdx,
      },
      {
        name: '@storybook/theming/create',
        alias: themingCreatePath,
      },
      {
        name: '@storybook/theming',
        alias: themingPath,
      },
      {
        name: '@storybook/components',
        alias: componentsPath,
      },
      {
        name: '@storybook/blocks',
        alias: blocksPath,
      }
    );
  } else {
    alias = {
      ...webpackConfig.resolve?.alias,
      react,
      '@storybook/theming/create': themingCreatePath,
      '@storybook/theming': themingPath,
      '@storybook/components': componentsPath,
      '@storybook/blocks': blocksPath,

      'react-dom': reactDom,
      '@mdx-js/react': mdx,
    };
  }

  const result = {
    ...webpackConfig,
    plugins: [
      ...(webpackConfig.plugins || []),

      ...(csfPluginOptions
        ? [(await import('@storybook/csf-plugin')).webpack(csfPluginOptions)]
        : []),
    ],
    resolve: {
      ...webpackConfig.resolve,
      alias,
    },
    module: {
      ...module,
      rules: [
        ...(module.rules || []),
        {
          test: /\.mdx$/,
          exclude: /(stories|story)\.mdx$/,
          use: [
            {
              loader: fileURLToPath(import.meta.resolve('@storybook/addon-docs/mdx-loader')),
              options: mdxLoaderOptions,
            },
          ],
        },
      ],
    },
  };

  return result;
}

const docs = (docsOptions: DocsOptions) => {
  return {
    ...docsOptions,
    defaultName: 'Docs',
    autodocs: 'tag',
  };
};

export const addons: PresetProperty<'addons'> = [
  fileURLToPath(import.meta.resolve('@storybook/react-dom-shim/preset')),
];

export const viteFinal = async (config: any, options: Options) => {
  const { plugins = [] } = config;
  const { mdxPlugin } = await import('./plugins/mdx-plugin');

  // Use the resolvedReact preset to alias react and react-dom to either the users version or the version shipped with addon-docs
  const { react, reactDom, mdx } = await getResolvedReact(options);

  const cliPath = dirname(fileURLToPath(import.meta.resolve('storybook/package.json')));
  const themingPath = join(cliPath, 'core', 'theming', 'index.js');
  const themingCreatePath = join(cliPath, 'core', 'theming', 'create.js');
  const componentsPath = join(cliPath, 'core', 'components', 'index.js');
  const blocksPath = dirname(fileURLToPath(import.meta.resolve('@storybook/blocks/package.json')));

  const packageDeduplicationPlugin = {
    name: 'storybook:package-deduplication',
    enforce: 'pre',
    config: () => ({
      resolve: {
        alias: {
          react,
          // Vite doesn't respect export maps when resolving an absolute path, so we need to do that manually here
          ...(isAbsolute(reactDom) && { 'react-dom/server': `${reactDom}/server.browser.js` }),
          'react-dom': reactDom,
          '@mdx-js/react': mdx,
          /**
           * Add aliases for `@storybook/addon-docs` & `@storybook/blocks` These must be singletons
           * to avoid multiple instances of react & emotion being loaded, both would cause the
           * components to fail to render.
           *
           * In the future the `@storybook/theming` and `@storybook/components` can be removed, as
           * they should be singletons in the future due to the peerDependency on `storybook`
           * package.
           */
          '@storybook/theming/create': themingCreatePath,
          '@storybook/theming': themingPath,
          '@storybook/components': componentsPath,
          '@storybook/blocks': blocksPath,
        },
      },
    }),
  };

  // add alias plugin early to ensure any other plugins that also add the aliases will override this
  // eg. the preact vite plugin adds its own aliases
  plugins.unshift(packageDeduplicationPlugin);
  // mdx plugin needs to be before any react plugins
  plugins.unshift(mdxPlugin(options));

  return config;
};

/*
 * This is a workaround for https://github.com/Swatinem/rollup-plugin-dts/issues/162
 * something down the dependency chain is using typescript namespaces, which are not supported by rollup-plugin-dts
 */
const webpackX = webpack as any;
const docsX = docs as any;

/**
 * If the user has not installed react explicitly in their project, the resolvedReact preset will
 * not be set. We then set it here in addon-docs to use addon-docs's react version that always
 * exists. This is just a fallback that never overrides the existing preset, but ensures that there
 * is always a resolved react.
 */
export const resolvedReact = async (existing: any) => ({
  react: existing?.react ?? dirname(fileURLToPath(import.meta.resolve('react/package.json'))),
  reactDom:
    existing?.reactDom ?? dirname(fileURLToPath(import.meta.resolve('react-dom/package.json'))),
  mdx: existing?.mdx ?? dirname(fileURLToPath(import.meta.resolve('@mdx-js/react'))),
});

const optimizeViteDeps = [
  '@mdx-js/react',
  '@storybook/addon-docs > acorn-jsx',
  '@storybook/addon-docs',
  '@storybook/addon-docs/mdx-react-shim',
  'markdown-to-jsx',
];

export { webpackX as webpack, docsX as docs, optimizeViteDeps };
