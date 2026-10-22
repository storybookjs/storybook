import type { ESTreeAST } from '../../ast.ts';
import { extractDefineMetaPropertiesNodes } from '../../extract/svelte/define-meta.ts';
import type { SvelteASTNodes } from '../../extract/svelte/nodes.ts';
import { InvalidComponentValueError } from '../../../utils/error/parser/analyse/define-meta.ts';

/**
 * A component value of `defineMeta` this analysis accepts:
 * a plain identifier, or a non-computed member expression over an identifier,
 * like `Input.Select` on an imported object or namespace.
 */
export type DefineMetaComponentValue =
  | ESTreeAST.Identifier
  | (ESTreeAST.MemberExpression & {
      object: ESTreeAST.Identifier;
      property: ESTreeAST.Identifier;
    });

interface Params {
  nodes: SvelteASTNodes;
  filename?: string;
}

export function getDefineMetaComponentValue(params: Params): DefineMetaComponentValue | undefined {
  const { nodes, filename } = params;
  const { component } = extractDefineMetaPropertiesNodes({
    nodes,
    properties: ['component'],
  });

  if (!component) {
    return;
  }

  const { value } = component;

  if (!isValidComponentValue(value)) {
    throw new InvalidComponentValueError({
      filename,
      componentProperty: component,
    });
  }

  return value;
}

/**
 * Structural check only. Whether an import actually binds the root identifier is resolved by
 * consumers, like the docgen. Computed access and deeper chains name no import, so they stay
 * rejected.
 */
function isValidComponentValue(
  value: ESTreeAST.Property['value']
): value is DefineMetaComponentValue {
  if (value.type === 'Identifier') {
    return true;
  }

  return (
    value.type === 'MemberExpression' &&
    !value.computed &&
    value.object.type === 'Identifier' &&
    value.property.type === 'Identifier'
  );
}

/**
 * The name a component value prints as in generated story markup:
 * the identifier itself, or `object.property` for a member expression like `Input.Select`.
 */
export function getDefineMetaComponentName(value: DefineMetaComponentValue | undefined): string {
  if (!value) {
    // Kept byte-identical with the previous `?.name` printing, which
    // `docgen/story-docs/svelte-csf-file.ts` recognizes via the `<undefined ` prefix.
    return 'undefined';
  }

  return value.type === 'MemberExpression'
    ? `${value.object.name}.${value.property.name}`
    : value.name;
}
