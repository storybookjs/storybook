import type { ComponentImportRef, JsDocTagMap } from 'storybook/internal/csf-tools';

import type ts from 'typescript';

export type ComponentRef = ComponentImportRef & {
  componentJsDocTags?: JsDocTagMap;
  /**
   * The file the story file's import resolves to, which names the package in the import lines. The
   * engines can document another file: the one core's resolver finds the component declared in.
   */
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
