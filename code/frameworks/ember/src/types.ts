import type { CompatibleString } from 'storybook/internal/types';

import type {
  BuilderOptions,
  StorybookConfigWebpack,
  TypescriptOptions as TypescriptOptionsBuilder,
} from '@storybook/builder-webpack5';
import type { WebpackStorybookConfig as StorybookConfigBase } from '@storybook/builder-webpack5';
import type { TypescriptOptions as TypescriptOptionsReact } from 'storybook/internal/types';

type FrameworkName = CompatibleString<'@storybook/ember-webpack5'>;
type BuilderName = CompatibleString<'@storybook/builder-webpack5'>;

/** Configure how Ember templates are compiled. */
export interface EmberTemplateOptions {
  /** AST plugins applied while precompiling templates. */
  polyfills?: unknown[];
}

export type FrameworkOptions = {
  builder?: BuilderOptions;
};

type StorybookConfigFramework = {
  /** Configure template compilation. */
  emberOptions?: EmberTemplateOptions;
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
  var __EMBER_GENERATED_DOC_JSON__: any;
}
