import type { SBType, StrictArgTypes } from 'storybook/internal/types';

import type { Docgen, Type } from '../svelte2tsx/generate-docgen.ts';

function summary(type: Type | undefined): string | undefined {
  if (!type) {
    return undefined;
  }
  if ('text' in type) {
    return type.text;
  }
  if ('types' in type) {
    return type.types
      .filter((t) => t.type !== 'null')
      .map(summary)
      .join(type.type === 'union' ? ' | ' : ' & ');
  }
  return type.type;
}

function storybookType(type: Type | undefined): SBType {
  if (!type) {
    return { name: 'other', value: 'unknown' };
  }
  switch (type.type) {
    case 'union':
    case 'intersection': {
      const members = type.types.filter((member) => member.type !== 'null');
      if (members.length === 1) return storybookType(members[0]);
      return { name: 'other', value: summary(type) ?? 'unknown' };
    }
    case 'array':
    case 'object':
    case 'function':
      return { name: 'other', value: type.text === '{}' ? 'object' : type.text };
    case 'literal':
      return { name: 'literal', value: type.value };
    case 'any':
      return { name: 'other', value: 'any' };
    case 'null':
    case 'undefined':
    case 'void':
      return { name: 'other', value: type.type };
    default:
      return { name: type.type };
  }
}

export function createServerArgTypes(docgen: Docgen): StrictArgTypes {
  const argTypes: StrictArgTypes = {};
  for (const prop of docgen.props) {
    const typeSummary = summary(prop.type);
    const slot = /^Snippet(?:<|$)/.test(prop.typeText ?? '');
    const callable =
      prop.type?.type === 'function' ||
      (prop.type?.type === 'union' && prop.type.types.some((type) => type.type === 'function'));
    const literals = prop.type?.type === 'union' ? prop.type.types : [];
    const values = literals.flatMap((type) =>
      type.type === 'literal' && typeof type.value !== 'boolean' ? [type.value] : []
    );
    const enumValues = values.length > 0 && values.length === literals.length ? values : undefined;
    const jsDocTags: Record<string, string[]> = {};
    for (const tag of prop.jsDocTags ?? []) {
      (jsDocTags[tag.name] ??= []).push(tag.text);
    }
    const defaultValue = prop.defaultValue?.text ?? jsDocTags.default?.[0];
    argTypes[prop.name] = {
      name: prop.name,
      description: prop.description,
      type: {
        ...(enumValues ? { name: 'enum', value: enumValues } : storybookType(prop.type)),
        required: prop.optional === false && defaultValue === undefined,
      },
      control:
        slot || callable
          ? false
          : enumValues
            ? { type: enumValues.length <= 4 ? 'radio' : 'select' }
            : {
                type:
                  prop.type?.type === 'string'
                    ? 'text'
                    : prop.type?.type === 'number'
                      ? 'number'
                      : prop.type?.type === 'boolean'
                        ? 'boolean'
                        : 'object',
              },
      ...(enumValues ? { options: enumValues } : {}),
      table: {
        type: { summary: typeSummary },
        defaultValue: { summary: defaultValue },
        category: slot
          ? 'slots'
          : callable && /^on[A-Z]|^on[a-z]+$/.test(prop.name)
            ? 'events'
            : 'properties',
        ...(Object.keys(jsDocTags).length > 0 ? { jsDocTags } : {}),
      },
    };
  }
  return argTypes;
}
