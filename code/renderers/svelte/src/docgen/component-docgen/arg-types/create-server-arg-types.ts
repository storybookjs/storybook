import {
  typeJsonToText,
  type ComponentDeclarationJson,
  type ComponentPropJson,
  type TypeJson,
} from 'svelte-docinfo';

import { babelParse, types as t } from 'storybook/internal/babel';
import type { SBType, StrictArgTypes } from 'storybook/internal/types';

function storybookType(text: string, type: TypeJson | undefined): SBType {
  if (type?.kind === 'literal') return { name: 'literal', value: type.value };
  if (type?.kind === 'union' || type?.kind === 'intersection') {
    const members = type.members.filter(
      (member) =>
        member.kind !== 'intrinsic' || (member.text !== 'null' && member.text !== 'undefined')
    );
    if (members.length === 1) return storybookType(typeJsonToText(members[0]), members[0]);
    if (type.kind === 'union') {
      const values = members.flatMap((member) =>
        member.kind === 'literal' && typeof member.value !== 'boolean' ? [member.value] : []
      );
      if (values.length > 0 && values.length === members.length) {
        return { name: 'enum', value: values };
      }
    }
    if (type.alias || members.length !== type.members.length) {
      text = members.map(typeJsonToText).join(type.kind === 'union' ? ' | ' : ' & ');
    }
  }
  const scalar = type?.kind === 'intrinsic' ? type.text : text;
  switch (scalar) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'symbol':
      return { name: scalar };
    default:
      return type?.kind === 'function' || /=>/.test(text)
        ? { name: 'function', raw: text }
        : { name: 'other', value: text === '{}' ? 'object' : text };
  }
}

function defaultSummary(text: string | undefined, quoted = true): string | undefined {
  if (text === undefined) return undefined;
  try {
    const statement = babelParse(`(${text})`).program.body[0];
    if (t.isExpressionStatement(statement) && t.isStringLiteral(statement.expression)) {
      return quoted ? JSON.stringify(statement.expression.value) : statement.expression.value;
    }
  } catch {
    return text;
  }
  return text;
}

function jsDocTags(prop: ComponentPropJson): Record<string, string[]> {
  return {
    ...(prop.deprecatedMessage !== undefined ? { deprecated: [prop.deprecatedMessage] } : {}),
    ...(prop.defaultValue !== undefined
      ? { default: [defaultSummary(prop.defaultValue, false) ?? prop.defaultValue] }
      : {}),
    ...(prop.examples.length > 0 ? { example: prop.examples } : {}),
    ...(prop.bindable ? { bindable: [''] } : {}),
  };
}

export function createServerArgTypes(docgen: ComponentDeclarationJson): StrictArgTypes {
  const argTypes: StrictArgTypes = {};
  for (const prop of docgen.props) {
    const slot = /^Snippet(?:<|$)/.test(prop.type ?? '');
    const type = storybookType(prop.type ?? 'unknown', prop.typeInfo);
    const callable = type.name === 'function' || prop.returnType !== undefined;
    const tags = jsDocTags(prop);
    argTypes[prop.name] = {
      name: prop.name,
      description: prop.description,
      type: { ...type, required: !prop.optional && prop.defaultValue === undefined },
      control:
        slot || callable
          ? false
          : type.name === 'enum'
            ? { type: type.value.length <= 4 ? 'radio' : 'select' }
            : {
                type:
                  type.name === 'string'
                    ? 'text'
                    : type.name === 'number'
                      ? 'number'
                      : type.name === 'boolean'
                        ? 'boolean'
                        : 'object',
              },
      ...(type.name === 'enum' ? { options: type.value } : {}),
      table: {
        type: { summary: prop.type },
        defaultValue: { summary: defaultSummary(prop.defaultValue) },
        category: slot
          ? 'slots'
          : callable && /^on[A-Z]|^on[a-z]+$/.test(prop.name)
            ? 'events'
            : 'properties',
        ...(Object.keys(tags).length > 0 ? { jsDocTags: tags } : {}),
      },
    };
  }
  return argTypes;
}
