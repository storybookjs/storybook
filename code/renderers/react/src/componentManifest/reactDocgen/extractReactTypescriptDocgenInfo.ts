import { logger } from 'storybook/internal/node-logger';

import { extractArgTypes } from '../../extractArgTypes.ts';
import { parseWithReactDocgenTypescript } from '../reactDocgenTypescript.ts';
import type { GetArgTypesDataOptions } from './utils.ts';

export const extractArgTypesFromDocgenTypescript = async ({
  componentFilePath,
  componentExportName,
  reactDocgenTypescriptOptions,
}: GetArgTypesDataOptions) => {
  try {
    const docs = await parseWithReactDocgenTypescript(
      componentFilePath,
      reactDocgenTypescriptOptions
    );
    const doc = componentExportName
      ? docs.find(
          ({ exportName, displayName }) =>
            exportName === componentExportName || displayName === componentExportName
        )
      : docs[0];
    return doc ? (extractArgTypes({ __docgenInfo: doc }) ?? {}) : null;
  } catch (error) {
    logger.debug(
      `Error parsing component file with react-docgen-typescript ${componentFilePath}: ${error}`
    );
    return null;
  }
};
