import { type types as t } from 'storybook/internal/babel';

import {
  classifyValue,
  isFunctionExpression,
  printValue,
  type ValuePlan,
} from './classify-value.ts';

/** Docgen-derived names that decide whether args become props, slots, or v-models. */
export interface VueDocgenArgInfo {
  /** Slot names reported by Vue docgen. */
  slots: Set<string>;
  /** Event names reported by Vue docgen. */
  events: Set<string>;
}

/** Where one CSF arg lands in the generated SFC. */
export type ArgRole = 'model' | 'prop' | 'slot';

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
 * Classifies merged CSF args by Vue docgen precedence: slot, v-model, then prop.
 *
 * Four outcomes, one per reason an arg can fail to render:
 *
 * - dropped silently — no static form exists and the runtime source decorator drops it too
 *   (functions passed as props, args explicitly set to `undefined`)
 * - dropped with a `warning` — the value references something the snippet cannot declare, so the
 *   rest of the story still renders and the omission is named
 * - `defer` — a static snippet would be a worse example than the runtime one: a slot receives a
 *   function, or nothing the story sets survived classification
 * - no result at all — the args container itself is unreadable, which the caller reports as an
 *   `error` (see `argsContainerError`)
 */
export function classifyArgs(
  args: Record<string, t.Node>,
  docgen: VueDocgenArgInfo
): ClassifyArgsResult {
  const classified: ClassifiedArg[] = [];
  const omitted: string[] = [];

  for (const [name, value] of Object.entries(args)) {
    const isSlot = docgen.slots.has(name);

    // A function slot carries content no static template can reproduce; the runtime source
    // decorator renders it properly, so leave the whole story to it.
    if (isSlot && isFunctionExpression(value)) {
      return { args: [], defer: true };
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
    classified.push({ name, value, role, plan });
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
