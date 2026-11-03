import type ts from 'typescript';

import type {
  StorybookConfig as StorybookConfigBase,
  TypescriptOptions as TypescriptOptionsBase,
  WebpackConfiguration as WebpackConfigurationBase,
} from '@storybook/core-webpack';

export type { BuilderResult } from '@storybook/core-webpack';

/**
 * The `react-docgen-typescript` parser options, copied from its type declarations.
 *
 * Builder docgen packages are optional peer dependencies, so published types must not import them:
 * a `.d.ts` import of a missing package fails `tsc` with TS2307 without `skipLibCheck`. A type test
 * keeps these shapes assignable both ways with the originals.
 */
export interface ReactDocgenTypescriptParserOptions {
  propFilter?:
    | { skipPropsWithName?: string[] | string; skipPropsWithoutDoc?: boolean }
    | ((
        props: {
          name: string;
          required: boolean;
          type: { name: string; value?: any; raw?: string };
          description: string;
          defaultValue: any;
          parent?: { name: string; fileName: string };
          declarations?: { name: string; fileName: string }[];
          tags?: {};
        },
        component: { name: string }
      ) => boolean);
  componentNameResolver?: (
    exp: ts.Symbol,
    source: ts.SourceFile
  ) => string | undefined | null | false;
  shouldExtractLiteralValuesFromEnum?: boolean;
  shouldRemoveUndefinedFromOptional?: boolean;
  shouldExtractValuesFromUnion?: boolean;
  shouldSortUnions?: boolean;
  skipChildrenPropWithoutDoc?: boolean;
  savePropValueAsString?: boolean;
  shouldIncludePropTagMap?: boolean;
  shouldIncludeExpression?: boolean;
  customComponentTypes?: string[];
}

/** Options of `@storybook/react-docgen-typescript-plugin`, copied from its declarations. */
export type ReactDocgenTypescriptOptions = ReactDocgenTypescriptParserOptions & {
  docgenCollectionName?: string | null;
  setDisplayName?: boolean;
  typePropName?: string;
  tsconfigPath?: string;
  compilerOptions?: ts.CompilerOptions;
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
