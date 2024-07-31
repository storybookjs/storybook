import * as path from 'path';
import type { InlineConfig as ViteInlineConfig, UserConfig } from 'vite';
import type { Options } from 'storybook/internal/types';
import { listStories } from './list-stories';

// It ensures that vite converts cjs deps into esm without vite having to find them during startup and then having to log a message about them and restart
// TODO: Many of the deps might be prebundled now though, so probably worth trying to remove and see what happens
const INCLUDE_CANDIDATES = [
  '@base2/pretty-print-object',
  '@emotion/core',
  '@emotion/is-prop-valid',
  '@emotion/styled',
  '@storybook/react > acorn-jsx',
  '@storybook/react',
  '@storybook/svelte',
  '@storybook/vue3',
  'acorn-jsx',
  'acorn-walk',
  'acorn',
  'airbnb-js-shims',
  'ansi-to-html',
  'axe-core',
  'color-convert',
  'deep-object-diff',
  'doctrine',
  'emotion-theming',
  'escodegen',
  'estraverse',
  'fast-deep-equal',
  'html-tags',
  'isobject',
  'loader-utils',
  'lodash/camelCase.js',
  'lodash/camelCase',
  'lodash/cloneDeep.js',
  'lodash/cloneDeep',
  'lodash/countBy.js',
  'lodash/countBy',
  'lodash/debounce.js',
  'lodash/debounce',
  'lodash/isEqual.js',
  'lodash/isEqual',
  'lodash/isFunction.js',
  'lodash/isFunction',
  'lodash/isPlainObject.js',
  'lodash/isPlainObject',
  'lodash/isString.js',
  'lodash/isString',
  'lodash/kebabCase.js',
  'lodash/kebabCase',
  'lodash/mapKeys.js',
  'lodash/mapKeys',
  'lodash/mapValues.js',
  'lodash/mapValues',
  'lodash/merge.js',
  'lodash/merge',
  'lodash/mergeWith.js',
  'lodash/mergeWith',
  'lodash/pick.js',
  'lodash/pick',
  'lodash/pickBy.js',
  'lodash/pickBy',
  'lodash/startCase.js',
  'lodash/startCase',
  'lodash/throttle.js',
  'lodash/throttle',
  'lodash/uniq.js',
  'lodash/uniq',
  'lodash/upperFirst.js',
  'lodash/upperFirst',
  'memoizerific',
  'overlayscrollbars',
  'polished',
  'prettier/parser-babel',
  'prettier/parser-flow',
  'prettier/parser-typescript',
  'prop-types',
  'qs',
  'react-dom',
  'react-dom/client',
  'react-fast-compare',
  'react-is',
  'react-textarea-autosize',
  'react',
  'react/jsx-runtime',
  'refractor/core',
  'refractor/lang/bash.js',
  'refractor/lang/css.js',
  'refractor/lang/graphql.js',
  'refractor/lang/js-extras.js',
  'refractor/lang/json.js',
  'refractor/lang/jsx.js',
  'refractor/lang/markdown.js',
  'refractor/lang/markup.js',
  'refractor/lang/tsx.js',
  'refractor/lang/typescript.js',
  'refractor/lang/yaml.js',
  'regenerator-runtime/runtime.js',
  'slash',
  'store2',
  'synchronous-promise',
  'telejson',
  'ts-dedent',
  'unfetch',
  'util-deprecate',
  'vue',
  'warning',
];

/**
 * Helper function which allows us to `filter` with an async predicate.  Uses Promise.all for performance.
 */
const asyncFilter = async (arr: string[], predicate: (val: string) => Promise<boolean>) =>
  Promise.all(arr.map(predicate)).then((results) => arr.filter((_v, index) => results[index]));

export async function getOptimizeDeps(config: ViteInlineConfig, options: Options) {
  const extraOptimizeDeps = await options.presets.apply('optimizeViteDeps', []);

  const { root = process.cwd() } = config;
  const { normalizePath, resolveConfig } = await import('vite');
  const absoluteStories = await listStories(options);
  const stories = absoluteStories.map((storyPath) => normalizePath(path.relative(root, storyPath)));
  // TODO: check if resolveConfig takes a lot of time, possible optimizations here
  const resolvedConfig = await resolveConfig(config, 'serve', 'development');

  // This function converts ids which might include ` > ` to a real path, if it exists on disk.
  // See https://github.com/vitejs/vite/blob/67d164392e8e9081dc3f0338c4b4b8eea6c5f7da/packages/vite/src/node/optimizer/index.ts#L182-L199
  const resolve = resolvedConfig.createResolver({ asSrc: false });
  const include = await asyncFilter(
    Array.from(new Set([...INCLUDE_CANDIDATES, ...extraOptimizeDeps])),
    async (id) => Boolean(await resolve(id))
  );

  const optimizeDeps: UserConfig['optimizeDeps'] = {
    ...config.optimizeDeps,
    // We don't need to resolve the glob since vite supports globs for entries.
    entries: stories,
    // We need Vite to precompile these dependencies, because they contain non-ESM code that would break
    // if we served it directly to the browser.
    include: [...include, ...(config.optimizeDeps?.include || [])],
  };

  return optimizeDeps;
}
