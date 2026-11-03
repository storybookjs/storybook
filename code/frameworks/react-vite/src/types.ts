import type {
  CompatibleString,
  StorybookConfig as StorybookConfigBase,
  TypescriptOptions as TypescriptOptionsBase,
} from 'storybook/internal/types';

import type { BuilderOptions, StorybookConfigVite } from '@storybook/builder-vite';

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
