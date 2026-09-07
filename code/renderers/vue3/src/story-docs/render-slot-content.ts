import { unwrapExpression, type ImportBinding } from 'storybook/internal/csf-tools';

import type { ClassifiedSlotArg } from './classify-args.ts';
import { isFunctionExpression } from './classify-value.ts';
import { printHFragment } from './print-h.ts';
import { renderSlotContent, type RenderContext } from './render-primitives.ts';

/** Slot children for one classified slot arg, or undefined when a function slot cannot render. */
export function renderSlotArgContent(
  arg: ClassifiedSlotArg,
  ctx: RenderContext,
  importBindings: Map<string, ImportBinding>,
  componentImportStatements: Map<string, string> = new Map()
): string | undefined {
  if (arg.plan.kind !== 'function-slot') {
    return renderSlotContent(arg, arg.plan, ctx);
  }

  const value = unwrapExpression(arg.value);
  return isFunctionExpression(value)
    ? printHFragment(value, { componentImportStatements, ctx, importBindings })
    : undefined;
}
