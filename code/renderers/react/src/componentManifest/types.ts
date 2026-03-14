import type ts from 'typescript';

export interface ResolvedComponentRef {
  componentName?: string;
  importId?: string;
  importName: string;
  member?: string;
  path?: string;
}

export interface ResolvedComponentTarget {
  componentRef: ResolvedComponentRef;
  propsType: ts.Type;
  symbol: ts.Symbol;
}
