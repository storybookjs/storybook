import type { CompatibleString } from 'storybook/internal/types';

import type {
  FrameworkOptions as FrameworkOptionsBase,
  StorybookConfig as StorybookConfigBase,
} from '@storybook/react-vite';

import type { RnwOptions } from 'vite-plugin-rnw';

export type FrameworkOptions = FrameworkOptionsBase & {
  /**
   * Many react native libraries aren't transpiled for the web, add them to this list to make sure
   * they get transpiled before attempting to load them on the web. We will automatically add
   * `react-native`, `@react-native`, `expo`, and `@expo` to this list.
   *
   * @example {modulesToTranspile: ['my-library']}
   */
  modulesToTranspile?: string[];
  pluginReactOptions?: RnwOptions;
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
