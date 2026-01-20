import { logger } from 'storybook/internal/node-logger';

import { extractArgTypes } from '../../extractArgTypes';
import { type getReactDocgen, parseWithReactDocgen } from '../reactDocgen';
import { cachedReadFileSync } from '../utils';
import { type GetArgTypesDataOptions } from './utils';

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

  return extractArgTypes({ __docgenInfo: docgen.reactDocgen }) ?? {};
};
