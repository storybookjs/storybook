interface SBBaseType {
  required?: boolean;
  raw?: string;
}

export type SBScalarType = SBBaseType & {
  name: 'boolean' | 'string' | 'number' | 'function' | 'symbol' | 'date';
};

export type SBArrayType = SBBaseType & {
  name: 'array';
  value: SBType;
};
export type SBNodeType = SBBaseType & {
  // Framework-specific “renderable node” (e.g. ReactNode, Vue VNode).
  name: 'node';
  renderer: string;
};
export type SBObjectType = SBBaseType & {
  name: 'object';
  value: Record<string, SBType>;
};
export type SBEnumType = SBBaseType & {
  name: 'enum';
  value: (string | number)[];
};
export type SBIntersectionType = SBBaseType & {
  name: 'intersection';
  value: SBType[];
};
export type SBUnionType = SBBaseType & {
  name: 'union';
  value: SBType[];
};
export type SBLiteralType = SBBaseType & {
  name: 'literal';
  value: unknown;
};
export type SBTupleType = SBBaseType & {
  name: 'tuple';
  value: SBType[];
};
export type SBOtherType = SBBaseType & {
  name: 'other';
  value: string;
};

export type SBType =
  | SBScalarType
  | SBEnumType
  | SBArrayType
  | SBNodeType
  | SBObjectType
  | SBIntersectionType
  | SBUnionType
  | SBLiteralType
  | SBTupleType
  | SBOtherType;
