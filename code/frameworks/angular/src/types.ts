import type { CompatibleString } from 'storybook/internal/types';

import type {
  BuilderOptions,
  StorybookConfigWebpack,
  TypescriptOptions as TypescriptOptionsBuilder,
} from '@storybook/builder-webpack5';
import type { WebpackStorybookConfig as StorybookConfigBase } from '@storybook/builder-webpack5';
import type { TypescriptOptions as TypescriptOptionsReact } from 'storybook/internal/types';

type FrameworkName = CompatibleString<'@storybook/angular'>;
type BuilderName = CompatibleString<'@storybook/builder-webpack5'>;

export type FrameworkOptions = AngularOptions & {
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

export interface AngularOptions {
  enableIvy?: boolean;
}

declare module '@storybook/core' {
  interface StorybookFrameworks {
    '@storybook/angular': { options: FrameworkOptions; config: StorybookConfig };
  }
}
