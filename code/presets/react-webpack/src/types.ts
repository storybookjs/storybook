import type {
  StorybookConfig as StorybookConfigBase,
  TypescriptOptions as TypescriptOptionsBase,
  WebpackConfiguration as WebpackConfigurationBase,
} from '@storybook/core-webpack';
import type { ReactDocgenTypescriptParserOptions } from '@storybook/react';

export type { BuilderResult } from '@storybook/core-webpack';

/** Options of `@storybook/react-docgen-typescript-plugin`, copied from its declarations. */
export type ReactDocgenTypescriptOptions = ReactDocgenTypescriptParserOptions & {
  docgenCollectionName?: string | null;
  setDisplayName?: boolean;
  typePropName?: string;
  tsconfigPath?: string;
  /** TypeScript `CompilerOptions`. */
  compilerOptions?: Record<string, any>;
  exclude?: string[];
  include?: string[];
};

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
