import type { CompatibleString } from 'storybook/internal/types';

import type {
  FrameworkOptions as FrameworkOptionsBase,
  StorybookConfig as StorybookConfigBase,
} from '@storybook/react-vite';

import type { BabelOptions, Options as ReactOptions } from 'vite-plugin-rnw';

export type FrameworkOptions = FrameworkOptionsBase & {
  pluginReactOptions?: Omit<ReactOptions, 'babel'> & { babel?: BabelOptions };
  /**
   * @deprecated These options will be ignored. Use `pluginReactOptions` now for everything and
   *   override includes in order to transpile node_modules pluginBabelOptions will be removed in
   *   the next major version. To configure babel, use `pluginReactOptions.babel`.
   */
  pluginBabelOptions?: Record<string, unknown>;
};

type FrameworkName = CompatibleString<'@storybook/react-native-web-vite'>;

/** The interface for Storybook configuration in `main.ts` files. */
export type StorybookConfig = Omit<StorybookConfigBase, 'framework'> & {
  framework:
    | FrameworkName
    | {
        name: FrameworkName;
        options: FrameworkOptions;
      };
};
