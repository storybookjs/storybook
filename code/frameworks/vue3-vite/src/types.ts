import type {
  CompatibleString,
  StorybookConfig as StorybookConfigBase,
} from 'storybook/internal/types';

import type { BuilderOptions, StorybookConfigVite } from '@storybook/builder-vite';

import type { ComponentMeta } from 'vue-component-meta';
import type { ComponentDoc } from 'vue-docgen-api';

type FrameworkName = CompatibleString<'@storybook/vue3-vite'>;
type BuilderName = CompatibleString<'@storybook/builder-vite'>;

/** Available docgen plugins for vue. */
export type VueDocgenPlugin = 'vue-docgen-api' | 'vue-component-meta';

import type { DocgenFilterPattern } from './plugins/vue-component-meta.ts';

export type { DocgenFilterPattern };

export type FrameworkOptions = {
  builder?: BuilderOptions;
  /**
   * Plugin to use for generation docs for component props, events, slots and exposes. Since
   * Storybook 8, the official vue plugin "vue-component-meta" (Volar) can be used which supports
   * more complex types, better type docs, support for js(x)/ts(x) components and more.
   *
   * "vue-component-meta" will become the new default in the future and "vue-docgen-api" will be
   * removed.
   *
   * Set to `false` to disable docgen processing entirely for improved build performance.
   *
   * @default 'vue-docgen-api'
   */
  docgen?:
    | boolean
    | VueDocgenPlugin
    | {
        plugin: 'vue-component-meta';
        /**
         * Tsconfig path to use. Should be set if your main `tsconfig.json` includes references to
         * other tsconfig files like `tsconfig.app.json`. Otherwise docgen might not be generated
         * correctly (e.g. import aliases are not resolved). The path is resolved relative to
         * project root.
         *
         * For further information, see our
         * [docs](https://storybook.js.org/docs/get-started/vue3-vite#override-the-default-configuration).
         *
         * @default 'tsconfig.json'
         */
        tsconfig: `${string}/tsconfig${string}.json` | `tsconfig${string}.json`;
        /**
         * Modules to extract docgen from, as a glob or regular expression. Replaces the default of
         * every `.vue`, `.ts`, `.js`, `.tsx` and `.jsx` module in the preview graph.
         *
         * Docgen resolves types through the whole program, so it is the most expensive part of a
         * Vue build. Narrowing this to the components you actually document can cut build time
         * substantially on larger projects, at the cost of no prop tables for anything excluded.
         *
         * Third-party components can be documented by including their path explicitly, for example
         * `['src/**', 'node_modules/some-library/**']`.
         *
         * @default /\.(vue|ts|js|tsx|jsx)$/
         */
        include?: DocgenFilterPattern;
        /**
         * Modules to skip, as a glob or regular expression. Added to the built-in exclusions
         * (stories, virtual modules and Storybook internals) rather than replacing them.
         *
         * @default undefined
         */
        exclude?: DocgenFilterPattern;
      };
};

type StorybookConfigFramework = {
  framework:
    | FrameworkName
    | {
        name: FrameworkName;
        options: FrameworkOptions;
      };
  core?: StorybookConfigBase['core'] & {
    builder?:
      | BuilderName
      | {
          name: BuilderName;
          options: BuilderOptions;
        };
  };
};

/** The interface for Storybook configuration in `main.ts` files. */
export type StorybookConfig = Omit<
  StorybookConfigBase,
  keyof StorybookConfigVite | keyof StorybookConfigFramework
> &
  StorybookConfigVite &
  StorybookConfigFramework;

/** Gets the type of a single array element. */
type ArrayElement<T> = T extends readonly (infer A)[] ? A : never;

/** Type of "__docgenInfo" depending on the used docgenPlugin. */
export type VueDocgenInfo<T extends VueDocgenPlugin> = T extends 'vue-component-meta'
  ? ComponentMeta
  : ComponentDoc;

/**
 * Single prop/event/slot/exposed entry of "__docgenInfo" depending on the used docgenPlugin.
 *
 * @example
 *
 * ```ts
 * type PropInfo = VueDocgenInfoEntry<'vue-component-meta', 'props'>;
 * ```
 */
export type VueDocgenInfoEntry<
  T extends VueDocgenPlugin,
  TKey extends 'props' | 'events' | 'slots' | 'exposed' | 'expose' =
    | 'props'
    | 'events'
    | 'slots'
    | 'exposed'
    | 'expose',
> = ArrayElement<
  T extends 'vue-component-meta'
    ? VueDocgenInfo<'vue-component-meta'>[Exclude<TKey, 'expose'>]
    : VueDocgenInfo<'vue-docgen-api'>[Exclude<TKey, 'exposed'>]
>;
