import { useContext } from 'react';

import type {
  DocsContextProps,
  ResolvedModuleExportFromType,
  ResolvedModuleExportType,
} from 'storybook/internal/types';

import { DocsContext } from './DocsContext';

export type Of = Parameters<DocsContextProps['resolveOf']>[0];

/**
 * A hook to resolve the `of` prop passed to a block.
 * will return the resolved module
 * if the resolved module is a meta it will include a preparedMeta property similar to a preparedStory
 * if the resolved module is a component it will include the project annotations
 */
export const useOf = <TType extends ResolvedModuleExportType>(
  moduleExportOrType: Of,
  validTypes?: TType[]
): ResolvedModuleExportFromType<TType> => {
  const context = useContext(DocsContext);
  return context.resolveOf(moduleExportOrType, validTypes);
};
