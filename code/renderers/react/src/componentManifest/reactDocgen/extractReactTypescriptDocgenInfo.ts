import { logger } from 'storybook/internal/node-logger';

import type { ParserOptions as ReactDocgenTypescriptOptions } from 'react-docgen-typescript';

import { extractArgTypes } from '../../extractArgTypes';
import { type GetArgTypesDataOptions, getTsConfig } from './utils';

interface PropFilterProps {
  parent?: { fileName: string };
}

interface ComponentDocgenResult {
  displayName?: string;
  filePath?: string;
  props?: Record<string, { type?: { name: string }; required?: boolean }>;
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
    const parser = withCompilerOptions(
      { ...tsConfig, noErrorTruncation: true, strict: true },
      mergedOptions
    );
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
    return extractArgTypes({ __docgenInfo: targetDocgen }) ?? {};
  } catch (error) {
    logger.debug(
      `Error parsing component file with react-docgen-typescript ${componentFilePath}: ${error}`
    );
    return null;
  }
};
