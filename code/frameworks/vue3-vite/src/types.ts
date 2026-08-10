import type {
  CompatibleString,
  StorybookConfig as StorybookConfigBase,
} from 'storybook/internal/types';

import type { BuilderOptions, StorybookConfigVite } from '@storybook/builder-vite';
import type { VueDocgenPlugin } from '@storybook/vue3';

export type { VueDocgenInfo, VueDocgenInfoEntry, VueDocgenPlugin } from '@storybook/vue3';

type FrameworkName = CompatibleString<'@storybook/vue3-vite'>;
type BuilderName = CompatibleString<'@storybook/builder-vite'>;

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
