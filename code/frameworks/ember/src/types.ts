import type { CompatibleString } from 'storybook/internal/types';

import type {
  BuilderOptions,
  StorybookConfigWebpack,
  TypescriptOptions as TypescriptOptionsBuilder,
} from '@storybook/builder-webpack5';
import type {
  StorybookConfig as StorybookConfigBase,
  TypescriptOptions as TypescriptOptionsReact,
} from '@storybook/core-webpack';

type FrameworkName = CompatibleString<'@storybook/ember-webpack5'>;
type BuilderName = CompatibleString<'@storybook/builder-webpack5'>;

export type FrameworkOptions = {
  builder?: BuilderOptions;
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
  typescript?: Partial<TypescriptOptionsBuilder & TypescriptOptionsReact> &
    StorybookConfigBase['typescript'];
};

/** The interface for Storybook configuration in `main.ts` files. */
export type StorybookConfig = Omit<
  StorybookConfigBase,
  keyof StorybookConfigWebpack | keyof StorybookConfigFramework
> &
  StorybookConfigWebpack &
  StorybookConfigFramework;

declare global {
  // eslint-disable-next-line no-var
  var __EMBER_GENERATED_DOC_JSON__: any;
}
