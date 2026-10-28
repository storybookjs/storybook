import { sanitize } from '../../../../csf/index.ts';
import type { ModuleExports, NormalizedComponentAnnotations } from '@storybook/core/internal/types';
import type { Renderer } from '@storybook/core/internal/types';

import { normalizeInputTypes } from './normalizeInputTypes.ts';

export function normalizeComponentAnnotations<TRenderer extends Renderer>(
  defaultExport: ModuleExports['default'],
  title: string = defaultExport.title,
  importPath?: string
): NormalizedComponentAnnotations<TRenderer> {
  const { id, argTypes } = defaultExport;
  return {
    id: sanitize(id || title),
    ...defaultExport,
    title,
    ...(argTypes && { argTypes: normalizeInputTypes(argTypes) }),
    parameters: {
      fileName: importPath,
      ...defaultExport.parameters,
    },
  };
}
