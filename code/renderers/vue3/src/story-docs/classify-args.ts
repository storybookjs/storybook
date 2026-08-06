import { type types as t } from 'storybook/internal/babel';
import type { StoryDocsError } from 'storybook/internal/types';

/** Docgen-derived names that decide whether args become props, slots, or v-models. */
export interface VueDocgenArgInfo {
  /** Slot names reported by Vue docgen. */
  slots: Set<string>;
  /** Event names reported by Vue docgen. */
  events: Set<string>;
}

/** A prop binding synthesized from a CSF arg. */
export interface PropArg {
  /** Arg name used as the Vue prop name. */
  name: string;
  /** CSF arg value expression. */
  value: t.Node;
  /** Classification for renderer dispatch. */
  type: 'prop';
}

/** A v-model binding synthesized from a CSF arg and matching update event. */
export interface ModelArg {
  /** Arg name used as the v-model model name. */
  name: string;
  /** CSF arg value expression. */
  value: t.Node;
  /** Classification for renderer dispatch. */
  type: 'model';
}

/** Slot content synthesized from a CSF arg and matching slot name. */
export interface SlotArg {
  /** Arg name used as the Vue slot name. */
  name: string;
  /** CSF arg value expression. */
  value: t.Node;
  /** Classification for renderer dispatch. */
  type: 'slot';
}

export type ClassifiedArg = ModelArg | PropArg | SlotArg;

export interface ClassifyArgsResult {
  /** Args that can be rendered into a static Vue snippet. */
  args: ClassifiedArg[];
  /** Story should fall back silently because it needs a deferred renderer. */
  skipSnippet?: boolean;
  /** Story-local fallback reason for deferred dynamic arg shapes. */
  error?: StoryDocsError;
}

const UNSUPPORTED_ARG_ERROR_NAME = 'Unsupported story args';

/** Classify merged CSF args by Vue docgen precedence: slot, v-model, function skip, prop. */
export function classifyArgs(
  args: Record<string, t.Node>,
  docgen: VueDocgenArgInfo
): ClassifyArgsResult {
  const classified: ClassifiedArg[] = [];

  for (const [name, value] of Object.entries(args)) {
    const unsupported = unsupportedArgReason(name, value);
    if (unsupported) {
      return {
        args: [],
        error: {
          name: UNSUPPORTED_ARG_ERROR_NAME,
          message: unsupported,
        },
      };
    }

    if (docgen.slots.has(name)) {
      if (isFunctionExpression(value)) {
        return { args: [], skipSnippet: true };
      }
      classified.push({ type: 'slot', name, value });
      continue;
    }

    if (docgen.events.has(`update:${name}`)) {
      classified.push({ type: 'model', name, value });
      continue;
    }

    if (isFunctionExpression(value)) {
      continue;
    }

    classified.push({ type: 'prop', name, value });
  }

  return { args: classified };
}

function unsupportedArgReason(name: string, value: t.Node): string | undefined {
  if (isFunctionExpression(value)) {
    return undefined;
  }

  const unwrapped = unwrapValue(value);
  if (unwrapped.type === 'Identifier') {
    return `Arg "${name}" references "${unwrapped.name}", which cannot be statically inlined yet.`;
  }

  // TODO: check for other non-serializable values like `new Date()`, `new Map()`
  // TODO: check how spread values can be supported, e.g. `args: { ...defaultArgs, foo: 'bar' }` or `args: { foo: 'bar', ...extraArgs }`
  if (hasSpreadValue(unwrapped)) {
    return `Arg "${name}" contains a spread value, which cannot be statically inlined yet.`;
  }

  return undefined;
}

function hasSpreadValue(node: t.Node): boolean {
  const unwrapped = unwrapValue(node);

  if (unwrapped.type === 'ObjectExpression') {
    return unwrapped.properties.some((property) => {
      if (property.type === 'SpreadElement') {
        return true;
      }
      if (property.type === 'ObjectProperty') {
        return hasSpreadValue(property.value);
      }
      return false;
    });
  }

  if (unwrapped.type === 'ArrayExpression') {
    return unwrapped.elements.some((element) => {
      if (!element) {
        return false;
      }
      if (element.type === 'SpreadElement') {
        return true;
      }
      return hasSpreadValue(element);
    });
  }

  return false;
}

function isFunctionExpression<T extends t.Node>(
  node: T
): node is T & (t.ArrowFunctionExpression | t.FunctionExpression) {
  const unwrapped = unwrapValue(node);
  return unwrapped.type === 'ArrowFunctionExpression' || unwrapped.type === 'FunctionExpression';
}

function unwrapValue(node: t.Node): t.Node {
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSTypeAssertion'
  ) {
    return unwrapValue(node.expression);
  }

  return node;
}
