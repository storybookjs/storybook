/** Types from sveltedoc-parser/typings */

export interface JSDocKeyword {
  name: string;
  description: string;
}

export type JSDocTypeKind = 'type' | 'const' | 'union' | 'function';

export interface JSDocTypeBase {
  kind: JSDocTypeKind;
  text: string;
}

export interface JSDocTypeElement extends JSDocTypeBase {
  kind: 'type';
  type: string;
  importPath?: string;
}

export interface JSDocTypeConst extends JSDocTypeBase {
  kind: 'const';
  type: string;
  value?: any;
}

export interface JSDocTypeUnion extends JSDocTypeBase {
  kind: 'union';
  type: JSDocType[];
}

export interface IMethodDefinition {
  params?: SvelteMethodParamItem[];
  return?: SvelteMethodReturnItem;
}

/** @since {4.2.0} */
export interface JSDocTypeFunction extends JSDocTypeBase, IMethodDefinition {
  kind: 'function';
}

export type JSDocType = JSDocTypeElement | JSDocTypeConst | JSDocTypeUnion | JSDocTypeFunction;

export interface SourceLocation {
  start: number;
  end: number;
}

export type JSVisibilityScope = 'public' | 'protected' | 'private';

export type JSVariableDeclarationKind = 'var' | 'let' | 'const';

export interface IScopedCommentItem {
  description?: string | null;
  visibility?: JSVisibilityScope;
  keywords?: JSDocKeyword[];
}

export interface ISvelteItem extends IScopedCommentItem {
  name: string;
  locations?: SourceLocation[];
}

export interface SvelteDataBindMapping {
  source: string;
  property: string;
}

export interface SvelteDataItem extends ISvelteItem {
  type?: JSDocType;
  kind?: JSVariableDeclarationKind;
  bind?: SvelteDataBindMapping[];
  static?: boolean;
  readonly?: boolean;
  defaultValue?: any;
  originalName?: string;
  localName?: string;
  importPath?: string;
}

export interface SvelteComputedItem extends ISvelteItem {
  dependencies: string[];
}

export interface SvelteMethodParamItem {
  name: string;
  type: JSDocType;
  repeated?: boolean;
  optional?: boolean;
  defaultValue?: string;
  description?: string;
  static?: boolean;
}

export interface SvelteMethodReturnItem {
  type: JSDocType;
  description?: string;
}

export interface SvelteMethodItem extends ISvelteItem, IMethodDefinition {}

export interface SvelteComponentItem extends ISvelteItem {
  importPath?: string;
}

export type SvelteEventModificator =
  | 'preventDefault'
  | 'stopPropagation'
  | 'passive'
  | 'capture'
  | 'once'
  | 'nonpassive'
  | 'self'
  | 'trusted';

export interface SvelteEventItem extends ISvelteItem {
  parent?: string | null;
  modificators?: SvelteEventModificator[];
}

export interface SvelteSlotParameter {
  name: string;
  type: JSDocType;
  description?: string;
}

export interface SvelteSlotItem extends ISvelteItem {
  parameters?: SvelteSlotParameter[];
  params?: SvelteSlotParameter[];
}

export interface SvelteRefItem extends ISvelteItem {
  parent?: string | null;
}

export interface SvelteComponentDoc {
  name?: string | null;
  version?: number;
  description?: string | null;
  data?: SvelteDataItem[];
  computed?: SvelteComputedItem[];
  components?: SvelteComponentItem[];
  events?: SvelteEventItem[];
  slots?: SvelteSlotItem[];
  refs?: SvelteRefItem[];

  methods?: SvelteMethodItem[];
  actions?: SvelteMethodItem[];
  helpers?: SvelteMethodItem[];
  transitions?: SvelteMethodItem[];
  dispatchers?: SvelteMethodItem[];
}
