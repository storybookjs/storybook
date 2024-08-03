import type { VueDocgenInfo, VueDocgenInfoEntry, VueDocgenPlugin } from '@storybook/vue3-vite';
import type { ExtractedProp } from 'storybook/internal/docs-tools';
import {
  convert,
  extractComponentProps,
  hasDocgen,
  type ArgTypesExtractor,
} from 'storybook/internal/docs-tools';
import type { SBType, StrictArgTypes, StrictInputType } from 'storybook/internal/types';

type PropertyMetaSchema = VueDocgenInfoEntry<'vue-component-meta', 'props'>['schema'];

// "exposed" is used by the vue-component-meta plugin while "expose" is used by vue-docgen-api
const ARG_TYPE_SECTIONS = ['props', 'events', 'slots', 'exposed', 'expose'] as const;

export const extractArgTypes: ArgTypesExtractor = (component): StrictArgTypes | null => {
  if (!hasDocgen<VueDocgenInfo<VueDocgenPlugin>>(component)) {
    return null;
  }

  const usedDocgenPlugin: VueDocgenPlugin =
    // eslint-disable-next-line no-underscore-dangle
    'exposed' in component.__docgenInfo ? 'vue-component-meta' : 'vue-docgen-api';

  const argTypes: StrictArgTypes = {};

  ARG_TYPE_SECTIONS.forEach((section) => {
    const props = extractComponentProps(component, section);

    props.forEach((extractedProp) => {
      let argType: StrictInputType | undefined;

      // use the corresponding extractor whether vue-docgen-api or vue-component-meta
      // was used for the docinfo
      if (usedDocgenPlugin === 'vue-docgen-api') {
        const docgenInfo = extractedProp.docgenInfo as VueDocgenInfoEntry<'vue-docgen-api'>;
        argType = extractFromVueDocgenApi(docgenInfo, section, extractedProp);
      } else {
        const docgenInfo =
          extractedProp.docgenInfo as unknown as VueDocgenInfoEntry<'vue-component-meta'>;
        argType = extractFromVueComponentMeta(docgenInfo, section);
      }

      // skip duplicate and global props
      if (!argType || argTypes[argType.name]) return;

      // disable controls for events and exposed since they can not be controlled
      const sectionsToDisableControls: (typeof section)[] = ['events', 'expose', 'exposed'];
      if (sectionsToDisableControls.includes(section)) {
        argType.control = { disable: true };
      }

      argTypes[argType.name] = argType;
    });
  });

  return argTypes;
};

/**
 * Extracts the argType for a prop/event/slot/expose generated with "vue-docgen-api".
 *
 * @param docgenInfo __docgenInfo from "vue-docgen-api"
 * @param section Whether the arg is a prop, event, slot or expose
 * @param extractedProp Extracted prop, needed when "section" is "slots"
 */
export const extractFromVueDocgenApi = (
  docgenInfo: VueDocgenInfoEntry<'vue-docgen-api'>,
  section: (typeof ARG_TYPE_SECTIONS)[number],
  extractedProp?: ExtractedProp
): StrictInputType => {
  let type: string | undefined;
  let sbType: SBType | undefined;

  if (section === 'events') {
    const eventInfo = docgenInfo as VueDocgenInfoEntry<'vue-docgen-api', 'events'>;
    type = eventInfo.type?.names.join();
    sbType = { name: 'other', value: type ?? '', required: false };
  }

  if (section === 'slots') {
    const slotInfo = docgenInfo as VueDocgenInfoEntry<'vue-docgen-api', 'slots'>;

    // extract type of slot bindings/props
    const slotBindings = slotInfo.bindings
      ?.filter((binding) => !!binding.name)
      .map((binding) => {
        return `${binding.name}: ${binding.type?.name ?? 'unknown'}`;
      })
      .join('; ');

    type = slotBindings ? `{ ${slotBindings} }` : undefined;
    sbType = { name: 'other', value: type ?? '', required: false };
  }

  if (section === 'props') {
    const propInfo = docgenInfo as VueDocgenInfoEntry<'vue-docgen-api', 'props'>;

    type = propInfo.type?.name;
    sbType = extractedProp ? convert(extractedProp.docgenInfo) : { name: 'other', value: type };

    // try to get more specific types for array, union and intersection
    // e.g. "string[]" instead of "Array"
    if (
      propInfo.type &&
      'elements' in propInfo.type &&
      Array.isArray(propInfo.type.elements) &&
      propInfo.type.elements.length > 0
    ) {
      const elements = (propInfo.type.elements as { name: string }[]).map((i) => i.name);

      if (type === 'Array') {
        const arrayElements = elements.length === 1 ? elements[0] : `(${elements.join(' | ')})`;
        type = `${arrayElements}[]`;
      }

      if (type === 'union') type = elements.join(' | ');
      else if (type === 'intersection') type = elements.join(' & ');
    }
  }

  const required = 'required' in docgenInfo ? docgenInfo.required ?? false : false;

  return {
    name: docgenInfo.name,
    description: docgenInfo.description,
    type: sbType ? { ...sbType, required } : { name: 'other', value: type ?? '' },
    table: {
      type: type ? { summary: type } : undefined,
      defaultValue: extractedProp?.propDef.defaultValue ?? undefined,
      jsDocTags: extractedProp?.propDef.jsDocTags,
      category: section,
    },
  };
};

/**
 * Extracts the argType for a prop/event/slot/exposed generated with "vue-component-meta".

 * @param docgenInfo __docgenInfo from "vue-component-meta"
 * @param section Whether the arg is a prop, event, slot or exposed
 */
export const extractFromVueComponentMeta = (
  docgenInfo: VueDocgenInfoEntry<'vue-component-meta'>,
  section: (typeof ARG_TYPE_SECTIONS)[number]
): StrictInputType | undefined => {
  // ignore global props
  if ('global' in docgenInfo && docgenInfo.global) return;

  const tableType = { summary: docgenInfo.type.replace(' | undefined', '') };

  if (section === 'props') {
    const propInfo = docgenInfo as VueDocgenInfoEntry<'vue-component-meta', 'props'>;
    const defaultValue = propInfo.default ? { summary: propInfo.default } : undefined;

    return {
      name: propInfo.name,
      description: formatDescriptionWithTags(propInfo.description, propInfo.tags),
      defaultValue,
      type: convertVueComponentMetaProp(propInfo),
      table: {
        type: tableType,
        defaultValue,
        category: section,
      },
    };
  } else {
    return {
      name: docgenInfo.name,
      description: 'description' in docgenInfo ? docgenInfo.description : '',
      type: { name: 'other', value: docgenInfo.type },
      table: { type: tableType, category: section },
    };
  }
};

/**
 * Converts the given prop info that was generated with "vue-component-meta" into a SBType.
 */
export const convertVueComponentMetaProp = (
  propInfo: Pick<VueDocgenInfoEntry<'vue-component-meta', 'props'>, 'schema' | 'required' | 'type'>
): SBType => {
  const schema = propInfo.schema;
  const required = propInfo.required;
  const fallbackSbType: SBType = { name: 'other', value: propInfo.type, required };

  const KNOWN_SCHEMAS = ['string', 'number', 'function', 'boolean', 'symbol'] as const;
  type KnownSchema = (typeof KNOWN_SCHEMAS)[number];

  if (typeof schema === 'string') {
    if (KNOWN_SCHEMAS.includes(schema as KnownSchema)) {
      return { name: schema as KnownSchema, required };
    }
    return fallbackSbType;
  }

  switch (schema.kind) {
    case 'enum': {
      // filter out empty or "undefined" for optional props
      let definedSchemas = schema.schema?.filter((item) => item !== 'undefined') ?? [];

      if (isBooleanSchema(definedSchemas)) {
        return { name: 'boolean', required };
      }

      if (isLiteralUnionSchema(definedSchemas) || isEnumSchema(definedSchemas)) {
        // remove quotes from literals
        const literals = definedSchemas.map((literal) => literal.replace(/"/g, ''));
        return { name: 'enum', value: literals, required };
      }

      if (definedSchemas.length === 1) {
        return convertVueComponentMetaProp({
          schema: definedSchemas[0],
          type: propInfo.type,
          required,
        });
      }

      // for union types like "string | number | boolean",
      // the schema will be "string | number | true | false"
      // so we need to replace "true | false" with boolean
      if (
        definedSchemas.length > 2 &&
        definedSchemas.includes('true') &&
        definedSchemas.includes('false')
      ) {
        definedSchemas = definedSchemas.filter((i) => i !== 'true' && i !== 'false');
        definedSchemas.push('boolean');
      }

      // recursively convert every type of the union
      return {
        name: 'union',
        value: definedSchemas.map((i) => {
          if (typeof i === 'object') {
            return convertVueComponentMetaProp({
              schema: i,
              type: i.type,
              required: false,
            });
          } else {
            return convertVueComponentMetaProp({ schema: i, type: i, required: false });
          }
        }),
        required,
      };
    }

    case 'array': {
      // filter out empty or "undefined" for optional props
      const definedSchemas = schema.schema?.filter((item) => item !== 'undefined') ?? [];
      if (definedSchemas.length === 0) return fallbackSbType;

      if (definedSchemas.length === 1) {
        return {
          name: 'array',
          value: convertVueComponentMetaProp({
            schema: definedSchemas[0],
            type: propInfo.type,
            required: false,
          }),
          required,
        };
      }

      // recursively convert every type of the array
      // e.g. "(string | number)[]"
      return {
        name: 'union',
        value: definedSchemas.map((i) => {
          if (typeof i === 'object') {
            return convertVueComponentMetaProp({
              schema: i,
              type: i.type,
              required: false,
            });
          } else {
            return convertVueComponentMetaProp({ schema: i, type: i, required: false });
          }
        }),
        required,
      };
    }

    case 'object':
      return {
        name: 'object',
        // while Storybook generates simple JSON object controls, nested schemas don't have specialized controls
        // so we don't need to recursively map the object schema here
        value: {},
        required,
      };

    default:
      return fallbackSbType;
  }
};

/**
 * Adds the descriptions for the given tags if available.
 */
const formatDescriptionWithTags = (
  description: string,
  tags: VueDocgenInfoEntry<'vue-component-meta', 'props'>['tags']
): string => {
  if (!tags?.length || !description) return description ?? '';
  const tagDescriptions = tags.map((tag) => `@${tag.name}: ${tag.text}`).join('<br>');
  return `${tagDescriptions}<br><br>${description}`;
};

/**
 * Checks whether the given schemas are all literal union schemas.
 *
 * @example "foo" | "bar" | "baz"
 */
const isLiteralUnionSchema = (schemas: PropertyMetaSchema[]): schemas is `"${string}"`[] => {
  return schemas.every(
    (schema) => typeof schema === 'string' && schema.startsWith('"') && schema.endsWith('"')
  );
};

/**
 * Checks whether the given schemas are all enums.
 *
 * @example [MyEnum.Foo, MyEnum.Bar]
 */
const isEnumSchema = (schemas: PropertyMetaSchema[]): schemas is string[] => {
  return schemas.every((schema) => typeof schema === 'string' && schema.includes('.'));
};

/**
 * Checks whether the given schemas are representing a boolean.
 *
 * @example [true, false]
 */
const isBooleanSchema = (
  schemas: PropertyMetaSchema[]
): schemas is ['true', 'false'] | ['false', 'true'] => {
  return schemas.length === 2 && schemas.includes('true') && schemas.includes('false');
};
