import type {
  CompatibleString,
  StorybookConfig as StorybookConfigBase,
  TypescriptOptions as TypescriptOptionsBase,
} from 'storybook/internal/types';

import type { BuilderOptions, StorybookConfigVite } from '@storybook/builder-vite';

/**
 * The `react-docgen-typescript` parser options, copied from its type declarations.
 *
 * Builder docgen packages are optional peer dependencies, so published types must not import them:
 * a `.d.ts` import of a missing package fails `tsc` with TS2307 without `skipLibCheck`. TypeScript
 * types are written structurally too, because the TypeScript 7 `typescript` package has no
 * compiler API types. A type test keeps these shapes assignable both ways with the originals.
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
  /** Receives a TypeScript `Symbol` and `SourceFile`. */
  componentNameResolver?: (exp: any, source: any) => string | undefined | null | false;
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

/** Options of `@joshwooding/vite-plugin-react-docgen-typescript`, copied from its declarations. */
export type ReactDocgenTypescriptOptions = ReactDocgenTypescriptParserOptions & {
  setDisplayName?: boolean;
  typePropName?: string;
  tsconfigPath?: string;
  /** TypeScript `CompilerOptions`. */
  compilerOptions?: Record<string, any>;
  exclude?: string[];
  include?: string[];
  fileSystemCache?: boolean | { enabled?: boolean; directory?: string };
  EXPERIMENTAL_useWatchProgram?: boolean;
  EXPERIMENTAL_useProjectService?: boolean;
};

type FrameworkName = CompatibleString<'@storybook/react-vite'>;
type BuilderName = CompatibleString<'@storybook/builder-vite'>;

export type FrameworkOptions = {
  builder?: BuilderOptions;
  strictMode?: boolean;
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
  features?: StorybookConfigBase['features'] & {
    /**
     * Enable the experimental `.test` function in CSF Next
     *
     * @see https://storybook.js.org/docs/api/main-config/main-config-features#experimentaltestsyntax
     */
    experimentalTestSyntax?: boolean;
  };
};

type TypescriptOptions = TypescriptOptionsBase & {
  /**
   * Sets the type of Docgen when working with React and TypeScript
   *
   * @default `'react-docgen'`
   * @deprecated Builder docgen is removed in Storybook 12. Use `features.docgenServer`.
   */
  reactDocgen: 'react-docgen-typescript' | 'react-docgen' | false;
  /**
   * Configures `@joshwooding/vite-plugin-react-docgen-typescript`
   *
   * @deprecated Builder docgen is removed in Storybook 12. Use `features.docgenServer`.
   */
  reactDocgenTypescriptOptions: ReactDocgenTypescriptOptions;
};

/** The interface for Storybook configuration in `main.ts` files. */
export type StorybookConfig = Omit<
  StorybookConfigBase,
  keyof StorybookConfigVite | keyof StorybookConfigFramework | 'typescript'
> &
  StorybookConfigVite &
  StorybookConfigFramework & {
    typescript?: Partial<TypescriptOptions>;
  };
