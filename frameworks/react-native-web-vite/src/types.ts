import type { CompatibleString } from 'storybook/internal/types';

import type {
  FrameworkOptions as FrameworkOptionsBase,
  StorybookConfig as StorybookConfigBase,
} from '@storybook/react-vite';

import type { BabelOptions, Options as ReactOptions } from '@vitejs/plugin-react';

export type FrameworkOptions = FrameworkOptionsBase & {
  pluginReactOptions?: Omit<ReactOptions, 'babel'> & { babel?: BabelOptions };
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
