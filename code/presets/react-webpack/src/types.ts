import type {
  StorybookConfig as StorybookConfigBase,
  TypescriptOptions as TypescriptOptionsBase,
  WebpackConfiguration as WebpackConfigurationBase,
} from '@storybook/core-webpack';

export type { BuilderResult } from '@storybook/core-webpack';

/**
 * Options of the deprecated builder docgen plugin for `react-docgen-typescript`.
 *
 * Declared here instead of imported, because the plugin is an optional peer dependency: the
 * published types must not import a package that is not installed.
 */
export interface ReactDocgenTypescriptOptions {
  /** Glob patterns of the files to parse. */
  include?: string[];
  /** Glob patterns of the files to skip. */
  exclude?: string[];
  /** Path to the tsconfig.json to read compiler options from. */
  tsconfigPath?: string;
  /** TypeScript compiler options, used instead of `tsconfigPath`. */
  compilerOptions?: Record<string, unknown>;
  /** Filter out props, for example those from `node_modules`. */
  propFilter?: ((prop: any, component: any) => boolean) | Record<string, unknown>;
  shouldExtractLiteralValuesFromEnum?: boolean;
  shouldExtractValuesFromUnion?: boolean;
  shouldRemoveUndefinedFromOptional?: boolean;
  shouldIncludePropTagMap?: boolean;
  shouldIncludeExpression?: boolean;
  skipChildrenPropWithoutDoc?: boolean;
  savePropValueAsString?: boolean;
  componentNameResolver?: (exp: any, source: any) => string | undefined | null | false;
  customComponentTypes?: string[];
  [option: string]: unknown;
}

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
