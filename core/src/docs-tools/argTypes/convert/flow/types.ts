interface FlowBaseType {
  name: string;
  type?: string;
  raw?: string;
  required?: boolean;
}

type FlowArgType = FlowType;

type FlowCombinationType = FlowBaseType & {
  name: 'union' | 'intersection';
  elements: FlowType[];
};

type FlowFuncSigType = FlowBaseType & {
  name: 'signature';
  type: 'function';
  signature: {
    arguments: FlowArgType[];
    return: FlowType;
  };
};

type FlowObjectSigType = FlowBaseType & {
  name: 'signature';
  type: 'object';
  signature: {
    properties: {
      key: string;
      value: FlowType;
    }[];
  };
};

type FlowScalarType = FlowBaseType & {
  name: 'any' | 'boolean' | 'number' | 'void' | 'string' | 'symbol';
};

export type FlowLiteralType = FlowBaseType & {
  name: 'literal';
  value: string;
};

type FlowArrayType = FlowBaseType & {
  name: 'Array';
  elements: FlowType[];
};

export type FlowSigType = FlowObjectSigType | FlowFuncSigType;

export type FlowType =
  | FlowScalarType
  | FlowLiteralType
  | FlowCombinationType
  | FlowSigType
  | FlowArrayType;
