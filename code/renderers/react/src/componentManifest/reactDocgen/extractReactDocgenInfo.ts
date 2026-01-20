import type { ComponentArgTypesData } from 'storybook/internal/core-server';
import type { SBType } from 'storybook/internal/csf';
import { logger } from 'storybook/internal/node-logger';

import type { PropDescriptor as ReactDocgenPropDescriptor } from 'react-docgen';

import { type getReactDocgen, parseWithReactDocgen } from '../reactDocgen';
import { cachedReadFileSync } from '../utils';
import {
  type GetArgTypesDataOptions,
  KNOWN_TYPE_NAMES,
  type ReactDocgenTsType,
  isElementsType,
  isLiteralType,
  isObjectSignatureType,
  mapCommonTypes,
} from './utils';

export function mapReactDocgenToArgType(docgenType: ReactDocgenTsType): SBType {
  const name = docgenType.name;

  // Try common type mappings first
  const commonType = mapCommonTypes(name);
  if (commonType) {
    return commonType;
  }

  // Handle signature types (objects and functions)
  if (name === 'signature') {
    if (isObjectSignatureType(docgenType)) {
      const properties: Record<string, SBType> = {};
      for (const prop of docgenType.signature.properties) {
        const key = typeof prop.key === 'string' ? prop.key : prop.key.name;
        properties[key] = mapReactDocgenToArgType(prop.value);
      }
      return { name: 'object', value: properties };
    }
    return { name: 'function' };
  }

  // Handle union types
  if (name === 'union') {
    const elements = isElementsType(docgenType) ? docgenType.elements : [];
    return { name: 'union', value: elements.map(mapReactDocgenToArgType) };
  }

  // Handle array types
  if (name === 'Array') {
    const element = isElementsType(docgenType) ? docgenType.elements[0] : undefined;

    if (!element) {
      return { name: 'array', value: { name: 'other', value: 'any' } };
    }

    const mapped = mapReactDocgenToArgType(element);
    // If it looks like an unresolved custom type, map as 'other' so core can be conservative.
    if (element.name && !KNOWN_TYPE_NAMES.has(element.name)) {
      return { name: 'array', value: { name: 'other', value: element.name } };
    }
    return { name: 'array', value: mapped };
  }

  // Handle tuple types
  if (name === 'tuple') {
    const elements = isElementsType(docgenType) ? docgenType.elements : [];
    return { name: 'tuple', value: elements.map(mapReactDocgenToArgType) };
  }

  // Handle literal types
  if (name === 'literal') {
    return { name: 'literal', value: isLiteralType(docgenType) ? docgenType.value : undefined };
  }

  // Default: treat as 'other'
  return { name: 'other', value: name };
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
    logger.debug(`Error parsing component file for docgen ${filePath}: ${error}`);
    return null;
  }
}

export const extractArgTypesFromDocgen = ({
  componentFilePath,
  componentExportName,
}: GetArgTypesDataOptions) => {
  const docgen = getComponentDocgen(componentFilePath, componentExportName);

  if (!docgen || docgen.reactDocgen.type !== 'success') {
    return null;
  }

  const props = docgen.reactDocgen.data.props ?? {};
  const mapped: ComponentArgTypesData = { props: {} };

  for (const [propName, propInfo] of Object.entries(props)) {
    const tsType = (propInfo as ReactDocgenPropDescriptor).tsType as ReactDocgenTsType | undefined;
    if (!tsType) {
      continue;
    }
    mapped.props![propName] = {
      required: Boolean((propInfo as ReactDocgenPropDescriptor).required),
      type: mapReactDocgenToArgType(tsType),
    };
  }

  return mapped;
};
