import type { ComponentType, JSX } from 'react';
import type { RootOptions } from 'react-dom/client';

import type { Canvas, WebRenderer } from 'storybook/internal/types';

export type { RenderContext, StoryContext } from 'storybook/internal/types';

export interface ReactRenderer extends WebRenderer {
  component: ComponentType<this['T']>;
  storyResult: StoryFnReactReturnType;
  mount: (ui?: JSX.Element) => Promise<Canvas>;
}

export interface ShowErrorArgs {
  title: string;
  description: string;
}

export interface ReactParameters {
  /** React renderer configuration */
  react?: {
    /**
     * Whether to enable React Server Components
     *
     * @see https://storybook.js.org/docs/get-started/frameworks/nextjs#react-server-components-rsc
     */
    rsc?: boolean;
    /** Options passed to React root creation */
    rootOptions?: RootOptions;
  };
}

export interface ReactTypes extends ReactRenderer {
  parameters: ReactParameters;
}

export type StoryFnReactReturnType = JSX.Element;

/** A prop as `react-docgen-typescript` passes it to a `propFilter` function. */
export interface ReactDocgenTypescriptPropItem {
  name: string;
  required: boolean;
  type: { name: string; value?: any; raw?: string };
  description: string;
  defaultValue: any;
  parent?: { name: string; fileName: string };
  declarations?: { name: string; fileName: string }[];
  tags?: object;
}

/**
 * The `react-docgen-typescript` parser options, which the deprecated builder docgen plugins of
 * `@storybook/react-vite` and `@storybook/preset-react-webpack` accept.
 *
 * Copied from `react-docgen-typescript`'s declarations instead of imported: it is an optional peer
 * dependency, and a `.d.ts` import of a missing package fails `tsc` without `skipLibCheck`. The
 * TypeScript symbol and source file are typed structurally, because the TypeScript 7 `typescript`
 * package has no compiler API types. Type tests in the frameworks keep this assignable both ways
 * with the originals.
 */
export interface ReactDocgenTypescriptParserOptions {
  propFilter?:
    | { skipPropsWithName?: string[] | string; skipPropsWithoutDoc?: boolean }
    // Bivariant like the original, so filters written against its own types still fit.
    | {
        bivarianceHack(prop: ReactDocgenTypescriptPropItem, component: { name: string }): boolean;
      }['bivarianceHack'];
  componentNameResolver?: {
    bivarianceHack(
      symbol: { readonly name: string; getName(): string },
      source: { readonly fileName: string; readonly text: string }
    ): string | undefined | null | false;
  }['bivarianceHack'];
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
