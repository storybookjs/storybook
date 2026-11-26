interface TSBaseType {
  name: string;
  type?: string;
  raw?: string;
  required?: boolean;
}

type TSArgType = TSType;

type TSUnionType = TSBaseType & {
  name: 'union';
  elements: TSType[];
};

export type TSIntersectionType = TSBaseType & {
  name: 'intersection';
  elements: TSType[];
};

type TSFuncSigType = TSBaseType & {
  name: 'signature';
  type: 'function';
  signature: {
    arguments: TSArgType[];
    return: TSType;
  };
};

type TSObjectSigType = TSBaseType & {
  name: 'signature';
  type: 'object';
  signature: {
    properties: {
      key: string;
      value: TSType;
    }[];
  };
};

type TSScalarType = TSBaseType & {
  name: 'any' | 'boolean' | 'number' | 'void' | 'string' | 'symbol';
};

// `undefined` and `null` get their own members (rather than being scalar names) so that
// `Extract<TSType, { name: '...' }>` can narrow to them.
type TSUndefinedType = TSBaseType & {
  name: 'undefined';
};

type TSNullType = TSBaseType & {
  name: 'null';
};

type TSLiteralType = TSBaseType & {
  name: 'literal';
  value: string;
};

type TSArrayType = TSBaseType & {
  name: 'Array';
  elements: TSType[];
};

export type TSSigType = TSObjectSigType | TSFuncSigType;

// Docgen emits `{ name: 'unknown' }` for type members it cannot resolve,
// e.g. the `string & {}` member of an open string union.
type TSUnknownType = TSBaseType & {
  name: 'unknown';
};

export type TSType =
  | TSScalarType
  | TSUndefinedType
  | TSNullType
  | TSLiteralType
  | TSUnionType
  | TSIntersectionType
  | TSSigType
  | TSArrayType
  | TSUnknownType;
