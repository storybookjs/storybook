import type {
  WebpackStorybookConfig as StorybookConfigBase,
  WebpackConfiguration as WebpackConfigurationBase,
} from '@storybook/builder-webpack5';
import type { TypescriptOptions as TypescriptOptionsBase } from '@storybook/core/internal/types';
import type { PluginOptions as ReactDocgenTypescriptOptions } from '@storybook/react-docgen-typescript-plugin';

export type { BuilderResult } from '@storybook/core/internal/types';

export interface ReactOptions {
  strictMode?: boolean;
}

export type TypescriptOptions = TypescriptOptionsBase & {
  /**
   * Sets the type of Docgen when working with React and TypeScript
   *
   * @default `'react-docgen'`
   * @deprecated Builder docgen is removed in Storybook 12. Use `features.docgenServer`.
   */
  reactDocgen: 'react-docgen-typescript' | 'react-docgen' | false;
  /**
   * Configures `react-docgen-typescript-plugin`
   *
   * @default
   * @see https://github.com/storybookjs/storybook/blob/next/code/builders/builder-webpack5/src/config/defaults.js#L4-L6
   * @deprecated Builder docgen is removed in Storybook 12. Use `features.docgenServer`.
   */
  reactDocgenTypescriptOptions: ReactDocgenTypescriptOptions;
};

export type StorybookConfig<TWebpackConfiguration = WebpackConfigurationBase> =
  StorybookConfigBase<TWebpackConfiguration> & {
    typescript?: Partial<TypescriptOptions>;
  };
