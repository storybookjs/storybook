import type { ComponentArgTypesData } from 'storybook/internal/core-server';
import type { SBType } from 'storybook/internal/csf';
import { logger } from 'storybook/internal/node-logger';

import type { ParserOptions as ReactDocgenTypescriptOptions } from 'react-docgen-typescript';

import { type GetArgTypesDataOptions, getTsConfig, mapCommonTypes } from './utils';

interface PropFilterProps {
  parent?: { fileName: string };
}

interface ComponentDocgenResult {
  displayName?: string;
  filePath?: string;
  props?: Record<string, { type?: { name: string }; required?: boolean }>;
}

/**
 * Maps a react-docgen-typescript type string to an SBType.
 *
 * React-docgen-typescript provides type information as strings (e.g., "string", "number",
 * "boolean") rather than the structured TypeDescriptor format used by react-docgen. This function
 * converts those string representations into the SBType format used by Storybook.
 */
export function mapReactDocgenTypescriptToArgType(typeString: string): SBType {
  const trimmed = typeString.trim();

  // Try common type mappings first
  const commonType = mapCommonTypes(trimmed);
  if (commonType) {
    return commonType;
  }

  // Handle additional special types specific to react-docgen-typescript
  if (trimmed === 'undefined') {
    return { name: 'other', value: 'void' };
  }
  if (trimmed === 'never') {
    return { name: 'other', value: 'never' };
  }

  // Handle function types
  if (
    trimmed.includes('=>') ||
    trimmed.startsWith('(') ||
    trimmed === 'Function' ||
    trimmed === 'function'
  ) {
    return { name: 'function' };
  }

  // Handle array types: Type[] or Array<Type>
  if (trimmed.endsWith('[]')) {
    const elementType = trimmed.slice(0, -2);
    return { name: 'array', value: mapReactDocgenTypescriptToArgType(elementType) };
  }
  if (trimmed.startsWith('Array<') && trimmed.endsWith('>')) {
    const elementType = trimmed.slice(6, -1);
    return { name: 'array', value: mapReactDocgenTypescriptToArgType(elementType) };
  }

  // Handle union types: Type1 | Type2
  if (trimmed.includes(' | ')) {
    const parts = trimmed.split(' | ').map((p) => p.trim());
    // Check if it's a literal union (all parts are string literals)
    const allLiterals = parts.every((p) => p.startsWith('"') || p.startsWith("'"));
    if (allLiterals) {
      return {
        name: 'union',
        value: parts.map((p) => ({
          name: 'literal' as const,
          value: p.replace(/^["']|["']$/g, ''),
        })),
      };
    }
    return { name: 'union', value: parts.map(mapReactDocgenTypescriptToArgType) };
  }

  // Handle literal string values (e.g., '"primary"' or "'secondary'")
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return { name: 'literal', value: trimmed.slice(1, -1) };
  }

  // Handle literal number values
  if (!isNaN(Number(trimmed))) {
    return { name: 'literal', value: Number(trimmed) };
  }

  // Handle literal boolean values
  if (trimmed === 'true' || trimmed === 'false') {
    return { name: 'literal', value: trimmed === 'true' };
  }

  // Default: treat as 'other' with the raw type string
  return { name: 'other', value: trimmed };
}

/**
 * Extracts component arg types from a file using react-docgen-typescript.
 *
 * This function uses the TypeScript compiler to parse component files and extract prop types with
 * more accurate type information, especially for complex TypeScript types.
 */
export const extractArgTypesFromDocgenTypescript = async ({
  componentFilePath,
  componentExportName,
  reactDocgenTypescriptOptions,
}: GetArgTypesDataOptions) => {
  try {
    // Using dynamic import for react-docgen-typescript
    const { withCompilerOptions } = (await import('react-docgen-typescript')).default;

    // Default options that match Storybook's expected behavior
    const defaultOptions: ReactDocgenTypescriptOptions = {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop: PropFilterProps) =>
        prop.parent ? !/node_modules/.test(prop.parent.fileName) : true,
      // We *need* this set so that RDT returns default values in the same format as react-docgen
      savePropValueAsString: true,
    };

    const tsConfig = await getTsConfig();

    const mergedOptions = {
      ...defaultOptions,
      ...reactDocgenTypescriptOptions,
      // Always ensure savePropValueAsString is true for consistency
      savePropValueAsString: true,
    };
    const parser = withCompilerOptions(tsConfig, mergedOptions);
    const docgens = parser.parse(componentFilePath) as ComponentDocgenResult[];

    if (!docgens || docgens.length === 0) {
      return null;
    }

    // Find the matching component if a name is specified
    let targetDocgen = docgens[0];
    if (componentExportName) {
      const match = docgens.find(
        (d) => d.displayName === componentExportName || d.filePath?.includes(componentExportName)
      );
      if (match) {
        targetDocgen = match;
      } else {
        // If specific component requested but not found, return null
        return null;
      }
    }

    const props = targetDocgen.props ?? {};
    const mapped: ComponentArgTypesData = { props: {} };

    for (const [propName, propInfo] of Object.entries(props)) {
      const typeString = propInfo.type?.name;
      if (!typeString) {
        continue;
      }
      mapped.props![propName] = {
        required: Boolean(propInfo.required),
        type: mapReactDocgenTypescriptToArgType(typeString),
      };
    }

    return mapped;
  } catch (error) {
    logger.debug(
      `Error parsing component file with react-docgen-typescript ${componentFilePath}: ${error}`
    );
    return null;
  }
};
