interface SBBaseType {
  required?: boolean;
  raw?: string;
}

export type SBScalarType = SBBaseType & {
  name: 'boolean' | 'string' | 'number' | 'function' | 'symbol';
};

export type SBArrayType = SBBaseType & {
  name: 'array';
  value: SBType;
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
export type SBOtherType = SBBaseType & {
  name: 'other';
  value: string;
};

export type SBType =
  | SBScalarType
  | SBEnumType
  | SBArrayType
  | SBObjectType
  | SBIntersectionType
  | SBUnionType
  | SBOtherType;

// Needed for ts-jest as we export * from './SBType.js' in the other file
// Might be a bug
export {};
