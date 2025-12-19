import type { ComponentDocgenData, ComponentDocgenPropType } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';

import type {
  ElementsType,
  LiteralType,
  ObjectSignatureType,
  PropDescriptor as ReactDocgenPropDescriptor,
  TSFunctionSignatureType,
  TypeDescriptor,
} from 'react-docgen';

import { type getReactDocgen, parseWithReactDocgen } from '../reactDocgen';
import { cachedReadFileSync } from '../utils';

export type GetDocgenDataOptions = {
  componentFilePath: string;
  componentExportName?: string;
};

type ReactDocgenTsType = TypeDescriptor<TSFunctionSignatureType>;
type ReactDocgenElementsType = ElementsType<TSFunctionSignatureType>;
type ReactDocgenObjectSignatureType = ObjectSignatureType<TSFunctionSignatureType>;
type ReactDocgenLiteralType = LiteralType;

function isElementsType(value: ReactDocgenTsType): value is ReactDocgenElementsType {
  return 'elements' in value;
}

function isObjectSignatureType(value: ReactDocgenTsType): value is ReactDocgenObjectSignatureType {
  return value.name === 'signature' && (value as ReactDocgenObjectSignatureType).type === 'object';
}

function isLiteralType(value: ReactDocgenTsType): value is ReactDocgenLiteralType {
  return value.name === 'literal';
}

export function mapReactDocgenType(docgenType: ReactDocgenTsType): ComponentDocgenPropType {
  const name = docgenType.name;

  switch (name) {
    case 'boolean':
      return { kind: 'boolean' };
    case 'string':
      return { kind: 'string' };
    case 'number':
      return { kind: 'number' };
    case 'Date':
      return { kind: 'date' };
    case 'JSX.Element':
    case 'ComponentType':
    case 'ReactComponentType':
    case 'ReactElement':
    case 'ReactReactElement':
    case 'ElementType':
    case 'ReactElementType':
    case 'ReactNode':
    case 'ReactReactNode':
      return { kind: 'node', renderer: 'react' };
    case 'signature': {
      // Object-signature: `{ foo: string }`
      if (isObjectSignatureType(docgenType)) {
        const properties: Record<string, ComponentDocgenPropType> = {};
        for (const prop of docgenType.signature.properties) {
          const key = typeof prop.key === 'string' ? prop.key : prop.key.name;
          properties[key] = mapReactDocgenType(prop.value);
        }
        return { kind: 'object', properties };
      }

      // Function signature
      return { kind: 'function' };
    }
    case 'union': {
      const elements = isElementsType(docgenType) ? docgenType.elements : [];
      return { kind: 'union', elements: elements.map(mapReactDocgenType) };
    }
    case 'Array': {
      const element = isElementsType(docgenType) ? docgenType.elements[0] : undefined;

      if (!element) {
        return { kind: 'array', element: { kind: 'any' } };
      }

      const mapped = mapReactDocgenType(element);
      // If it looks like an unresolved custom type, map as 'other' so core can be conservative.
      if (
        element.name &&
        ![
          'string',
          'number',
          'boolean',
          'Date',
          'ReactNode',
          'ReactElementType',
          'signature',
          'union',
          'Array',
          'tuple',
          'literal',
          'null',
          'void',
          'any',
          'unknown',
        ].includes(element.name)
      ) {
        return { kind: 'array', element: { kind: 'other', name: element.name } };
      }
      return { kind: 'array', element: mapped };
    }
    case 'tuple': {
      const elements = isElementsType(docgenType) ? docgenType.elements : [];
      return { kind: 'tuple', elements: elements.map(mapReactDocgenType) };
    }
    case 'literal':
      return { kind: 'literal', value: isLiteralType(docgenType) ? docgenType.value : undefined };
    case 'null':
      return { kind: 'null' };
    case 'void':
      return { kind: 'void' };
    case 'any':
      return { kind: 'any' };
    case 'unknown':
      return { kind: 'unknown' };
    default:
      return { kind: 'other', name };
  }
}

/**
 * Extracts component name and React docgen data from a component file.
 *
 * This function reads a component file and uses react-docgen to parse its documentation and type
 * information. If a component name is provided, it will attempt to find that specific component's
 * documentation. If no name is provided, it will return the first component found or the default
 * export.
 *
 * @param filePath The absolute path to the component file.
 * @param componentName Optional name of the specific component to extract (if multiple components
 *   exist in the file).
 * @returns An object containing the component name and its react-docgen data, or null if no
 *   component is found.
 * @public
 */
export function getComponentDocgen(
  filePath: string,
  componentName?: string
): { componentName: string; reactDocgen: ReturnType<typeof getReactDocgen> } | null {
  try {
    const code = cachedReadFileSync(filePath, 'utf-8') as string;
    const docgens = parseWithReactDocgen(code, filePath);

    if (docgens.length === 0) {
      return null;
    }

    // If a specific component name is requested, find it
    if (componentName) {
      const matchingDocgen = docgens.find(
        (docgen) =>
          docgen.actualName === componentName ||
          docgen.displayName === componentName ||
          docgen.exportName === componentName
      );

      if (matchingDocgen) {
        return {
          componentName: matchingDocgen.actualName || matchingDocgen.displayName || componentName,
          reactDocgen: { type: 'success', data: matchingDocgen },
        };
      }

      // If a specific component name was requested but not found, return null
      return null;
    }

    // Otherwise, return the first component found (typically the default export)
    const firstDocgen = docgens[0];
    return {
      componentName: firstDocgen.actualName || firstDocgen.displayName || 'Unknown',
      reactDocgen: { type: 'success', data: firstDocgen },
    };
  } catch (error) {
    logger.debug(`Error parsing component file ${filePath}: ${error}`);
    return null;
  }
}

export const extractDocgenData = ({
  componentFilePath,
  componentExportName,
}: GetDocgenDataOptions) => {
  const docgen = getComponentDocgen(componentFilePath, componentExportName);

  if (!docgen || docgen.reactDocgen.type !== 'success') {
    return null;
  }

  const props = docgen.reactDocgen.data.props ?? {};
  const mapped: ComponentDocgenData = { props: {} };

  for (const [propName, propInfo] of Object.entries(props)) {
    const tsType = (propInfo as ReactDocgenPropDescriptor).tsType as ReactDocgenTsType | undefined;
    if (!tsType) {
      continue;
    }
    mapped.props![propName] = {
      required: Boolean((propInfo as ReactDocgenPropDescriptor).required),
      type: mapReactDocgenType(tsType),
    };
  }

  return mapped;
};
