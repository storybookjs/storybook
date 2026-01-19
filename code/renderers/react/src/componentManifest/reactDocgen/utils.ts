import type { SBType } from 'storybook/internal/csf';

import type {
  ElementsType,
  LiteralType,
  ObjectSignatureType,
  TSFunctionSignatureType,
  TypeDescriptor,
} from 'react-docgen';
import type { ParserOptions as ReactDocgenTypescriptOptions } from 'react-docgen-typescript';

export type ReactDocgenConfig = 'react-docgen' | 'react-docgen-typescript' | false;

export type GetArgTypesDataOptions = {
  componentFilePath: string;
  componentExportName?: string;
  reactDocgen?: ReactDocgenConfig;
  reactDocgenTypescriptOptions?: ReactDocgenTypescriptOptions;
};

export type ReactDocgenTsType = TypeDescriptor<TSFunctionSignatureType>;
export type ReactDocgenElementsType = ElementsType<TSFunctionSignatureType>;
export type ReactDocgenObjectSignatureType = ObjectSignatureType<TSFunctionSignatureType>;
export type ReactDocgenLiteralType = LiteralType;

export const REACT_NODE_TYPES = new Set<string>([
  'JSX.Element',
  'ComponentType',
  'ReactComponentType',
  'ReactElement',
  'ReactReactElement',
  'ElementType',
  'ReactElementType',
  'ReactNode',
  'ReactReactNode',
]);

// Types that are considered "known" and should be mapped recursively in arrays
export const KNOWN_TYPE_NAMES = new Set([
  'boolean',
  'string',
  'number',
  'Date',
  ...REACT_NODE_TYPES,
  'signature',
  'union',
  'Array',
  'tuple',
  'literal',
  'null',
  'void',
  'any',
  'unknown',
]);

/** Check if a type name represents a React node type */
export function isReactNodeType(typeName: string): boolean {
  if (REACT_NODE_TYPES.has(typeName)) {
    return true;
  }
  // Handle React. prefixed versions and generics (for react-docgen-typescript)
  if (
    typeName === 'React.ReactNode' ||
    typeName === 'React.ReactElement' ||
    typeName.startsWith('ReactElement<') ||
    typeName.startsWith('React.ReactElement<')
  ) {
    return true;
  }
  return false;
}

export function isElementsType(value: ReactDocgenTsType): value is ReactDocgenElementsType {
  return 'elements' in value;
}

export function isObjectSignatureType(
  value: ReactDocgenTsType
): value is ReactDocgenObjectSignatureType {
  return value.name === 'signature' && (value as ReactDocgenObjectSignatureType).type === 'object';
}

export function isLiteralType(value: ReactDocgenTsType): value is ReactDocgenLiteralType {
  return value.name === 'literal';
}

/**
 * Common mappings for primitive and React node types for both react-docgen and
 * react-docgen-typescript
 */
export function mapCommonTypes(typeName: string): SBType | null {
  // Handle primitives
  if (typeName === 'boolean') {
    return { name: 'boolean' };
  }
  if (typeName === 'string') {
    return { name: 'string' };
  }
  if (typeName === 'number') {
    return { name: 'number' };
  }
  if (typeName === 'Date') {
    return { name: 'date' };
  }

  // Handle React node types
  if (isReactNodeType(typeName)) {
    return { name: 'node', renderer: 'react' };
  }

  // Handle special types
  if (typeName === 'null') {
    return { name: 'other', value: 'null' };
  }
  if (typeName === 'void') {
    return { name: 'other', value: 'void' };
  }
  if (typeName === 'any') {
    return { name: 'other', value: 'any' };
  }
  if (typeName === 'unknown') {
    return { name: 'other', value: 'unknown' };
  }

  return null;
}
