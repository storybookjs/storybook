import { type types as t } from 'storybook/internal/babel';

import {
  classifyValue,
  isFunctionExpression,
  isSelfContainedFunction,
  printValue,
  unwrapValue,
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
 * `omit` and `unrepresentable` args never become a {@link ClassifiedArg}, so the renderer has no
 * fallback branch to get wrong.
 */
export type RenderableValuePlan = Extract<ValuePlan, { kind: 'hoist' | 'inline' }>;

export interface ClassifiedArg {
  name: string;
  value: t.Node;
  role: ArgRole;
  /** Vue event name bound in the template, present when role is 'event'. */
  eventName?: string;
  plan: RenderableValuePlan;
}

export interface ClassifyArgsResult {
  /** Args that can be rendered into a static Vue snippet. */
  args: ClassifiedArg[];
  /** Story needs a real renderer, so runtime source stays authoritative and no snippet is emitted. */
  defer?: boolean;
  /** Args left out of the snippet because their values do not resolve statically. */
  warning?: string;
}

/**
 * Classifies merged CSF args by Vue docgen precedence: slot, event, v-model, then prop.
 *
 * Four outcomes, one per reason an arg can fail to render:
 *
 * - dropped silently — no static form exists and the runtime source decorator drops it too
 *   (functions passed as undeclared args, args explicitly set to `undefined`, empty strings)
 * - dropped with a `warning` — the value references something the snippet cannot declare, so the
 *   rest of the story still renders and the omission is named
 * - `defer` — a static snippet would be a worse example than the runtime one: a slot receives
 *   function content the snippet cannot reproduce, or nothing the story sets survived
 *   classification
 * - no result at all — the args container itself is unreadable, which the caller reports as an
 *   `error` (see `argsContainerError`)
 *
 * Function args matching a declared event render as listeners, and declared function props hoist.
 */
export function classifyArgs(
  args: Record<string, t.Node>,
  docgen: VueDocgenArgInfo
): ClassifyArgsResult {
  const classified: ClassifiedArg[] = [];
  const omitted: string[] = [];

  for (const [name, value] of Object.entries(args)) {
    const isSlot = docgen.slots.has(name);

    if (isSlot && isFunctionExpression(value)) {
      const returned = returnedExpression(value);
      if (returned) {
        const plan = classifyValue(returned);

        if (plan.kind === 'inline' || plan.kind === 'hoist') {
          classified.push({
            name,
            value: returned,
            role: 'slot',
            plan: planSlotValue(returned, plan),
          });
          continue;
        }

        if (plan.kind === 'omit') {
          continue;
        }
      }

      // A function slot carries content no static template can reproduce; the runtime source
      // decorator renders it properly, so leave the whole story to it.
      return { args: [], defer: true };
    }

    const eventName = declaredEventName(name, docgen.events);
    if (eventName !== undefined && isFunctionExpression(value)) {
      if (isSelfContainedFunction(value)) {
        classified.push({ name, value, role: 'event', eventName, plan: { kind: 'hoist' } });
      } else {
        omitted.push(`${name}: ${printValue(value)}`);
      }
      continue;
    }

    if (isFunctionExpression(value)) {
      if (docgen.props.has(name)) {
        if (isSelfContainedFunction(value)) {
          classified.push({ name, value, role: 'prop', plan: { kind: 'hoist' } });
        } else {
          omitted.push(`${name}: ${printValue(value)}`);
        }
      }
      continue;
    }

    const plan = classifyValue(value);

    if (plan.kind === 'omit') {
      continue;
    }

    if (plan.kind === 'unrepresentable') {
      omitted.push(`${name}: ${printValue(value)}`);
      continue;
    }

    const role: ArgRole = isSlot ? 'slot' : docgen.events.has(`update:${name}`) ? 'model' : 'prop';
    classified.push({
      name,
      value,
      role,
      plan: role === 'slot' ? planSlotValue(value, plan) : plan,
    });
  }

  // A snippet showing none of the args the story actually sets is a worse example than the one the
  // runtime source decorator builds from real values, so leave it to that instead.
  if (omitted.length > 0 && classified.length === 0) {
    return { args: [], defer: true };
  }

  return {
    args: classified,
    ...(omitted.length > 0
      ? { warning: `Omitted args that cannot be resolved statically: ${omitted.join(', ')}` }
      : {}),
  };
}

function planSlotValue(value: t.Node, plan: RenderableValuePlan): RenderableValuePlan {
  return unwrapValue(value).type === 'StringLiteral' ? { kind: 'hoist' } : plan;
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

/**
 * Extracts the expression a function slot returns when it has a single static return path.
 *
 * @example `() => 'hi'` → `'hi'`
 */
function returnedExpression(node: t.Node): t.Node | undefined {
  const value = unwrapValue(node);
  if (value.type !== 'ArrowFunctionExpression' && value.type !== 'FunctionExpression') {
    return undefined;
  }

  if (value.body.type !== 'BlockStatement') {
    return value.body;
  }

  if (value.body.body.length !== 1) {
    return undefined;
  }

  const statement = value.body.body[0];
  return statement.type === 'ReturnStatement' && statement.argument
    ? statement.argument
    : undefined;
}
