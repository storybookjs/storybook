import { type types as t } from 'storybook/internal/babel';
import { returnedExpression, unwrapExpression } from 'storybook/internal/csf-tools';

import {
  classifyValue,
  isFunctionExpression,
  isSelfContainedFunction,
  printValue,
  type ValuePlan,
} from './classify-value.ts';

/** Docgen-derived names that decide whether args become props, slots, listeners, or v-models. */
export interface VueDocgenArgInfo {
  /** Prop names reported by Vue docgen. */
  props: Set<string>;
  /** Slot names reported by Vue docgen. */
  slots: Set<string>;
  /** Event names reported by Vue docgen. */
  events: Set<string>;
}

/** Where one CSF arg lands in the generated SFC. */
export type ArgRole = 'event' | 'model' | 'prop' | 'slot';

/**
 * The plans that produce snippet source.
 *
 * `omit` and `unrepresentable` args never become a renderable {@link ClassifiedArg}, so the
 * renderer has no fallback branch to get wrong.
 */
export type RenderableValuePlan = Extract<ValuePlan, { kind: 'hoist' | 'inline' }>;

/** A function-valued slot arg that only a render-tree-aware renderer can realize. */
export interface FunctionSlotPlan {
  kind: 'function-slot';
}

export interface ClassifiedPropLikeArg {
  name: string;
  value: t.Node;
  role: Exclude<ArgRole, 'slot'>;
  /** Vue event name bound in the template, present when role is 'event'. */
  eventName?: string;
  plan: RenderableValuePlan;
}

export interface ClassifiedSlotArg {
  name: string;
  value: t.Node;
  role: 'slot';
  plan: RenderableValuePlan | FunctionSlotPlan;
}

/** Split by role so `arg.role` checks narrow the plans a renderer has to handle. */
export type ClassifiedArg = ClassifiedPropLikeArg | ClassifiedSlotArg;

/**
 * Outcome of classifying one arg, before any story-level decision is taken.
 *
 * `omit` and `unrepresentable` stay distinct because the story-level aggregation treats them
 * differently: the first is silent, the second is named in `unresolved`.
 */
export type ArgClassification =
  | { kind: 'classified'; arg: ClassifiedArg }
  | { kind: 'omit' }
  | { kind: 'unset' }
  | { kind: 'unrepresentable' };

export interface ClassifyArgsResult {
  /** Args that can be rendered into a static Vue snippet. */
  args: ClassifiedArg[];
  /**
   * Args explicitly set to undefined, rendered as if never written — bindings and collisions
   * ignore them even where Vue itself would treat a present-but-undefined value differently.
   */
  unset: Set<string>;
  /** Source text of args dropped because their values do not resolve statically. */
  unresolved: string[];
}

/**
 * Classifies merged CSF args by Vue docgen precedence: slot, event, v-model, then prop.
 *
 * Three outcomes, one per reason an arg can fail to render:
 *
 * - dropped silently — no static form exists and the runtime source decorator drops it too
 *   (functions passed as undeclared args, empty strings)
 * - named in `unresolved` — the value references something the snippet cannot declare; the caller
 *   decides whether that reads as a partial snippet or as no snippet at all
 * - forwarded as a `function-slot` plan — a slot receives function content only a
 *   render-tree-aware renderer can realize; rendering bails back to runtime source otherwise
 *
 * Function args matching a declared event render as listeners, and declared function props hoist.
 */
export function classifyArgs(
  args: Record<string, t.Node>,
  docgen: VueDocgenArgInfo
): ClassifyArgsResult {
  const classified: ClassifiedArg[] = [];
  const unset = new Set<string>();
  const unresolved: string[] = [];

  for (const [name, value] of Object.entries(args)) {
    const result = classifyArg(name, value, docgen);

    if (result.kind === 'classified') {
      classified.push(result.arg);
    } else if (result.kind === 'unset') {
      unset.add(name);
    } else if (result.kind === 'unrepresentable') {
      unresolved.push(`${name}: ${printValue(value)}`);
    }
  }

  return { args: classified, unset, unresolved };
}

/**
 * Classifies one arg by Vue docgen precedence: slot, event, v-model, then prop.
 *
 * Shared with the `h()` renderer, so a prop written directly in a render tree lands in the same
 * role, with the same plan, as the identical value routed through the story's `args`.
 */
export function classifyArg(
  name: string,
  value: t.Node,
  docgen: VueDocgenArgInfo
): ArgClassification {
  const isSlot = docgen.slots.has(name);

  if (isSlot && isFunctionExpression(value)) {
    const returned = returnedExpression(unwrapExpression(value));
    if (returned) {
      const plan = classifyValue(returned);

      if (plan.kind === 'inline' || plan.kind === 'hoist') {
        return {
          kind: 'classified',
          arg: { name, value: returned, role: 'slot', plan },
        };
      }

      if (plan.kind === 'omit' || plan.kind === 'unset') {
        return { kind: 'omit' };
      }
    }

    // No static template can reproduce this content, but an `h()` tree renderer may still realize
    // the function itself, so forward it instead of deferring outright.
    return {
      kind: 'classified',
      arg: { name, value, role: 'slot', plan: { kind: 'function-slot' } },
    };
  }

  const eventName = declaredEventName(name, docgen.events);
  if (eventName !== undefined && isFunctionExpression(value)) {
    return isSelfContainedFunction(value)
      ? {
          kind: 'classified',
          arg: { name, value, role: 'event', eventName, plan: { kind: 'hoist' } },
        }
      : { kind: 'unrepresentable' };
  }

  if (isFunctionExpression(value)) {
    if (!docgen.props.has(name)) {
      return { kind: 'omit' };
    }
    return isSelfContainedFunction(value)
      ? { kind: 'classified', arg: { name, value, role: 'prop', plan: { kind: 'hoist' } } }
      : { kind: 'unrepresentable' };
  }

  const plan = classifyValue(value);

  if (plan.kind === 'omit' || plan.kind === 'unrepresentable') {
    return { kind: plan.kind };
  }

  if (plan.kind === 'unset') {
    return { kind: 'unset' };
  }

  return {
    kind: 'classified',
    arg: isSlot
      ? { name, value, role: 'slot', plan }
      : {
          name,
          value,
          role: docgen.events.has(`update:${name}`) ? 'model' : 'prop',
          plan,
        },
  };
}

/**
 * Matches Storybook handler args to declared Vue events.
 *
 * @example `onItemClick` → `itemClick`; `onUpdate:checked` → `update:checked`
 */
function declaredEventName(name: string, events: Set<string>): string | undefined {
  const match = /^on([A-Z].*)/.exec(name);
  if (!match) {
    return undefined;
  }

  const [, rawEventName] = match;
  const eventName = `${rawEventName.charAt(0).toLowerCase()}${rawEventName.slice(1)}`;
  return events.has(eventName) ? eventName : undefined;
}
