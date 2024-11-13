import { logger } from 'storybook/internal/client-logger';
import type { ArgTypesExtractor } from 'storybook/internal/docs-tools';
import type { SBScalarType, StrictArgTypes } from 'storybook/internal/types';

import type {
  JSDocKeyword,
  JSDocType,
  JSDocTypeConst,
  SvelteComponentDoc,
} from 'sveltedoc-parser/typings';

import { IS_SVELTE_V4 } from '../utils';

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
      const argTypes = createArgTypes(docgen);

      if (!IS_SVELTE_V4) {
        // NOTE: Filter out event handlers `on:*` as they're deprecated from Svelte v5
        return Object.fromEntries(Object.entries(argTypes).filter(([name, _]) => !name.startsWith('on:')));
      }

      return argTypes;
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
        ...parseTypeToControl(item.type),
        name: item.name,
        description: item.description || undefined,
        type: {
          required: hasKeyword('required', item.keywords || []),
          name: item.type?.text === '{}' ? 'object' : (item.type?.text as SBScalarType['name']),
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
 *
 * @param type
 * @returns String
 */
const parseTypeToControl = (type: JSDocType | undefined): any => {
  if (!type) {
    return null;
  }

  if (type.kind === 'type') {
    switch (type.type) {
      case 'string':
        return { control: { type: 'text' } };
      case 'any':
        return { control: { type: 'object' } };
      default:
        return { control: { type: type.type } };
    }
  } else if (type.kind === 'union') {
    if (
      Array.isArray(type.type) &&
      !type.type.some(
        (t) => t.kind !== 'const' || !['string', 'number', 'null', 'undefined'].includes(t.type)
      )
    ) {
      const options = type.type.map((t) => (t as JSDocTypeConst).value);
      return {
        control: {
          type: 'radio',
          labels: options.map(String),
        },
        options,
      };
    }
  } else if (type.kind === 'function') {
    return { control: null };
  }

  return null;
};
