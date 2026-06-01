import type { ScriptHandler } from 'vue-docgen-api';

import type * as bt from '@babel/types';
import * as recast from 'recast';

/**
 * `vue-docgen-api` only resolves prop defaults declared with `withDefaults(defineProps<…>(), {…})`.
 * Vue 3.5's reactive props destructure declares them via destructuring instead:
 *
 * ```ts
 * const { label = '你好' } = defineProps<{ label?: string }>();
 * ```
 *
 * `vue-docgen-api` ignores those destructured defaults, so the docs table shows no default. This
 * handler reads the destructured defaults and assigns them to the matching prop descriptors,
 * producing the same `defaultValue` shape `withDefaults` does.
 *
 * Remove this handler once `vue-docgen-api` extracts destructured defaults natively.
 */
export const setupPropsDestructureHandler: ScriptHandler = async (
  documentation,
  _component,
  ast
) => {
  for (const statement of ast.program.body) {
    if (statement.type !== 'VariableDeclaration') {
      continue;
    }

    for (const declarator of statement.declarations) {
      if (declarator.id.type !== 'ObjectPattern' || !isDefinePropsCall(declarator.init)) {
        continue;
      }

      for (const property of declarator.id.properties) {
        // skip rest elements (`...rest`), computed and shorthand keys without a default
        if (
          property.type !== 'ObjectProperty' ||
          property.key.type !== 'Identifier' ||
          property.value.type !== 'AssignmentPattern'
        ) {
          continue;
        }

        const descriptor = documentation.getPropDescriptor(property.key.name);

        // don't clobber a default that was already resolved (e.g. via `withDefaults`)
        if (descriptor.defaultValue) {
          continue;
        }

        const defaultExpression = property.value.right;
        descriptor.defaultValue = {
          func:
            defaultExpression.type === 'ArrowFunctionExpression' ||
            defaultExpression.type === 'FunctionExpression',
          value: recast.print(defaultExpression).code,
        };
      }
    }
  }
};

/** Whether the node is a `defineProps(…)` call, including the `withDefaults(defineProps(…), …)` form. */
function isDefinePropsCall(node: bt.Expression | null | undefined): boolean {
  if (!node || node.type !== 'CallExpression' || node.callee.type !== 'Identifier') {
    return false;
  }
  if (node.callee.name === 'defineProps') {
    return true;
  }
  if (node.callee.name === 'withDefaults') {
    return isDefinePropsCall(node.arguments[0] as bt.Expression | undefined);
  }
  return false;
}
