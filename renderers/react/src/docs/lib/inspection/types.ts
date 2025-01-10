export enum InspectionType {
  IDENTIFIER = 'Identifier',
  LITERAL = 'Literal',
  OBJECT = 'Object',
  ARRAY = 'Array',
  FUNCTION = 'Function',
  CLASS = 'Class',
  ELEMENT = 'Element',
  UNKNOWN = 'Unknown',
}

export interface InspectionInferedType {
  type: InspectionType;
}

export interface InspectionIdentifier extends InspectionInferedType {
  type: InspectionType.IDENTIFIER;
  identifier: string;
}

export interface InspectionLiteral extends InspectionInferedType {
  type: InspectionType.LITERAL;
}

export interface InspectionObject extends InspectionInferedType {
  type: InspectionType.OBJECT;
  depth: number;
}

export interface InspectionArray extends InspectionInferedType {
  type: InspectionType.ARRAY;
  depth: number;
}

export interface InspectionClass extends InspectionInferedType {
  type: InspectionType.CLASS;
  identifier: string;
}

export interface InspectionFunction extends InspectionInferedType {
  type: InspectionType.FUNCTION;
  identifier?: string;
  params: any[];
  hasParams: boolean;
}

export interface InspectionElement extends InspectionInferedType {
  type: InspectionType.ELEMENT;
  identifier?: string;
}

export interface InspectionUnknown extends InspectionInferedType {
  type: InspectionType.UNKNOWN;
}

export type InspectionIdentifiableInferedType =
  | InspectionIdentifier
  | InspectionClass
  | InspectionFunction
  | InspectionElement;

export interface InspectionResult {
  inferredType: InspectionInferedType;
  ast?: any;
}
