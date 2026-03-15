import type ts from 'typescript';

export type ComponentRef = {
  componentName: string;
  localImportName?: string;
  importId?: string;
  componentJsDocTags?: Record<string, string[]>;
  importOverride?: string;
  importName?: string;
  namespace?: string;
  /** For member expressions like `Accordion.Root`, the member part (`"Root"`). */
  member?: string;
  path?: string;
  isPackage: boolean;
  /** Minimum JSX nesting depth where this component first appears (1 = outermost JSX element). */
  jsxDepth?: number;
  reactDocgen?: ReturnType<typeof import('./reactDocgen').getReactDocgen>;
  reactDocgenTypescript?: import('./reactDocgenTypescript').ComponentDocWithExportName;
  reactComponentMeta?: import('./componentMetaExtractor').ComponentDoc;
  reactDocgenTypescriptError?: { name: string; message: string };
};

export interface ResolvedComponentTarget {
  componentRef: ComponentRef;
  propsType: ts.Type;
  symbol: ts.Symbol;
}
