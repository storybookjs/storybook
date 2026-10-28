import { getProjectRoot } from '@storybook/core/internal/common';
import type { ArgTypes } from '@storybook/core/internal/csf';

import { isAbsolute, join } from 'pathe';

import { extractArgTypesFromDocgen } from './extractReactDocgenInfo.ts';
import { extractArgTypesFromDocgenTypescript } from './extractReactTypescriptDocgenInfo.ts';
import type { GetArgTypesDataOptions, ReactDocgenConfig } from './utils.ts';

/** Extract a component's argTypes with the docgen that `typescriptOptions` selects. */
export async function getArgTypesData({
  componentFilePath,
  componentExportName,
  typescriptOptions,
}: GetArgTypesDataOptions & {
  typescriptOptions: {
    reactDocgen?: ReactDocgenConfig;
    reactDocgenTypescriptOptions?: Record<string, unknown>;
  };
}): Promise<ArgTypes | null> {
  if (!componentFilePath) {
    return null;
  }

  const { reactDocgen = 'react-docgen', reactDocgenTypescriptOptions } = typescriptOptions;

  // If docgen is disabled, return null
  if (reactDocgen === false) {
    return null;
  }

  const resolvedFilePath = isAbsolute(componentFilePath)
    ? componentFilePath
    : join(getProjectRoot(), componentFilePath);

  // Choose the appropriate extractor based on the reactDocgen option
  if (reactDocgen === 'react-docgen-typescript') {
    return extractArgTypesFromDocgenTypescript({
      componentFilePath: resolvedFilePath,
      componentExportName,
      reactDocgenTypescriptOptions,
    });
  }
  // Default to 'react-docgen'
  return extractArgTypesFromDocgen({
    componentFilePath: resolvedFilePath,
    componentExportName,
  });
}
