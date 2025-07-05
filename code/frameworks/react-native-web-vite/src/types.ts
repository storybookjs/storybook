import type { CompatibleString } from 'storybook/internal/types';

import type {
  FrameworkOptions as FrameworkOptionsBase,
  StorybookConfig as StorybookConfigBase,
} from '@storybook/react-vite';

import type { BabelOptions, Options as ReactOptions } from '@vitejs/plugin-react';
import type { BabelPluginOptions } from 'vite-plugin-babel';

export type FrameworkOptions = FrameworkOptionsBase & {
  pluginReactOptions?: Omit<ReactOptions, 'babel'> & { babel?: BabelOptions };
  pluginBabelOptions?: BabelPluginOptions & {
    presetReact?: {
      [key: string]: any;
      runtime?: 'automatic' | 'classic';
      importSource?: string;
    };
  };
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
