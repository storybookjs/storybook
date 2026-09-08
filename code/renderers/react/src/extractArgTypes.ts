import type { ArgTypesExtractor, PropDef } from 'storybook/internal/docs-tools';
import type { StrictArgTypes } from 'storybook/internal/types';

import { isTextNodeValue } from './componentManifest/reactDocgen/textNodeValues.ts';
import { extractProps } from './extractProps.ts';

export const extractArgTypes: ArgTypesExtractor = (component): StrictArgTypes | null => {
  if (component) {
    const { rows } = extractProps(component);
    if (rows) {
      return rows.reduce((acc: StrictArgTypes, row: PropDef) => {
        const {
          name,
          description,
          type,
          sbType,
          defaultValue: defaultSummary,
          jsDocTags,
          required,
        } = row;

        acc[name] = {
          name,
          description,
          type: isTextNodeValue(sbType)
            ? { required, name: 'node' as const, renderer: 'react' }
            : { required, ...sbType },
          table: {
            type: type ?? undefined,
            jsDocTags,
            defaultValue: defaultSummary ?? undefined,
          },
        };
        return acc;
      }, {});
    }
  }

  return null;
};
