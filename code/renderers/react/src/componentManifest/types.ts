import type { ComponentImportRef } from 'storybook/internal/csf-tools';

import type { ParserOptions } from 'react-docgen-typescript';
import type ts from 'typescript';

// `tsconfigPath` is absent from react-docgen-typescript's own `ParserOptions`, but the Vite and
// Webpack docgen plugins Storybook documents both accept it, so users already write it in `main.ts`.
export type ReactDocgenTypescriptOptions = ParserOptions & {
  tsconfigPath?: string;
};

export type ComponentRef = ComponentImportRef & {
  componentJsDocTags?: Record<string, string[]>;
  path?: string;
  isPackage: boolean;
  /** Minimum JSX nesting depth where this component first appears (1 = outermost JSX element). */
  jsxDepth?: number;
  reactDocgen?: ReturnType<typeof import('./reactDocgen').getReactDocgen>;
  reactDocgenTypescript?: import('./reactDocgenTypescript').ComponentDocWithExportName;
  reactComponentMeta?: import('./componentMeta/componentMetaExtractor').ComponentDoc;
  reactDocgenTypescriptError?: { name: string; message: string };
};

export interface ResolvedComponentTarget {
  componentRef: ComponentRef;
  propsType: ts.Type;
  symbol: ts.Symbol;
}
