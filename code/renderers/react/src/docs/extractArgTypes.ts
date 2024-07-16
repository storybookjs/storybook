import type { StrictArgTypes } from 'storybook/internal/types';
import type { PropDef, ArgTypesExtractor } from 'storybook/internal/docs-tools';
import { extractProps } from './extractProps';

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
          type: { required, ...sbType },
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
