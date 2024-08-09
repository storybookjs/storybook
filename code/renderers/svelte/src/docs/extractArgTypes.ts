import { logger } from 'storybook/internal/client-logger';
import type { ArgTypesExtractor } from 'storybook/internal/docs-tools';
import type { SBScalarType, StrictArgTypes } from 'storybook/internal/types';

import type {
  JSDocKeyword,
  JSDocType,
  JSDocTypeConst,
  SvelteComponentDoc,
} from 'sveltedoc-parser/typings';

type ComponentWithDocgen = {
  __docgen: SvelteComponentDoc;
};

function hasKeyword(keyword: string, keywords: JSDocKeyword[]): boolean {
  return keywords ? keywords.find((k) => k.name === keyword) != null : false;
}

export const extractArgTypes: ArgTypesExtractor = (
  component: ComponentWithDocgen
): StrictArgTypes | null => {
  try {
    // eslint-disable-next-line no-underscore-dangle
    const docgen = component.__docgen;
    if (docgen) {
      return createArgTypes(docgen);
    }
  } catch (err) {
    logger.log(`Error extracting argTypes: ${err}`);
  }
  return {};
};

export const createArgTypes = (docgen: SvelteComponentDoc) => {
  const results: StrictArgTypes = {};
  if (docgen.data) {
    docgen.data.forEach((item) => {
      results[item.name] = {
        control: parseTypeToControl(item.type),
        name: item.name,
        description: item.description || undefined,
        type: {
          required: hasKeyword('required', item.keywords || []),
          name: item.type?.text as SBScalarType['name'],
        },
        table: {
          type: {
            summary: item.type?.text,
          },
          defaultValue: {
            summary: item.defaultValue,
          },
          category: 'properties',
        },
      };
    });
  }

  if (docgen.events) {
    docgen.events.forEach((item) => {
      results[`event_${item.name}`] = {
        name: item.name,
        action: item.name,
        control: false,
        ...(item.description ? { description: item.description } : {}),
        table: {
          category: 'events',
        },
      };
    });
  }

  if (docgen.slots) {
    docgen.slots.forEach((item) => {
      results[`slot_${item.name}`] = {
        name: item.name,
        control: false,
        description: [item.description, item.params?.map((p) => `\`${p.name}\``).join(' ')]
          .filter((p) => p)
          .join('\n\n'),
        table: {
          category: 'slots',
        },
      };
    });
  }

  return results;
};

/**
 * Function to convert the type from sveltedoc-parser to a storybook type
 * @param type
 * @returns string
 */
const parseTypeToControl = (type: JSDocType | undefined): any => {
  if (!type) {
    return null;
  }

  if (type.kind === 'type') {
    switch (type.type) {
      case 'string':
        return { type: 'text' };

      case 'enum':
        return { type: 'radio' };
      case 'any':
        return { type: 'object' };
      default:
        return { type: type.type };
    }
  } else if (type.kind === 'union') {
    // @ts-expect-error TODO: fix, this seems like a broke in package update
    if (Array.isArray(type.type) && !type.type.find((t) => t.type !== 'string')) {
      return {
        type: 'radio',
        options: type.type
          .filter((t) => t.kind === 'const')
          .map((t) => (t as JSDocTypeConst).value),
      };
    }
  }

  return null;
};
