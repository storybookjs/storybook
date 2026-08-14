import type { ImportBinding } from 'storybook/internal/csf-tools';

import type { ClassifiedArg, ClassifiedSlotArg } from './classify-args.ts';
import {
  createRenderContext,
  formatRenderedProp,
  indent,
  partitionArgsByRole,
  renderEventArg,
  renderPreparedSfcSnippet,
  renderPropLikeArg,
  wrapSlotContent,
  type RenderContext,
} from './render-primitives.ts';
import { renderSlotArgContent } from './transform-h.ts';

export interface RenderSfcInput {
  /** Component identifier from CSF meta.component. */
  componentName: string;
  /** Classified args to render into the SFC snippet. */
  args: ClassifiedArg[];
  /** Import bindings from the CSF module, used to import components a slot renders. */
  importBindings: Map<string, ImportBinding>;
}

export interface RenderSfcResult {
  /** Vue SFC snippet for the docs payload. */
  snippet: string;
  /** Import statements for components the snippet references. */
  imports: string[];
}

/** Render classified CSF args into the same SFC block shape as Vue's runtime source decorator. */
export function renderSfcSnippet(input: RenderSfcInput): RenderSfcResult | undefined {
  const ctx = createRenderContext();
  const partitioned = partitionArgsByRole(input.args);
  const props = partitioned.props.map((arg) => formatRenderedProp(renderPropLikeArg(arg, ctx)));
  const events = partitioned.events.map((arg) => formatRenderedProp(renderEventArg(arg, ctx)));

  const slotSource: string[] = [];
  for (const arg of partitioned.slots) {
    const rendered = renderSlotArg(arg, ctx, input.importBindings);
    // Only function-slot plans fail to render; without their content the snippet would misrepresent
    // the story, so bail and leave it to runtime source.
    if (rendered === undefined) {
      return undefined;
    }
    slotSource.push(rendered);
  }

  const slotSourceCode = slotSource.join('\n');
  const openTag = [input.componentName, ...props, ...events].join(' ');
  const templateCode = slotSourceCode
    ? `<${openTag}>\n${indent(slotSourceCode)}\n</${input.componentName}>`
    : `<${openTag} />`;

  return {
    snippet: renderPreparedSfcSnippet({ templateCode, ctx }),
    imports: Array.from(ctx.componentImports),
  };
}

function renderSlotArg(
  arg: ClassifiedSlotArg,
  ctx: RenderContext,
  importBindings: Map<string, ImportBinding>
): string | undefined {
  const content = renderSlotArgContent(arg, ctx, importBindings);
  return content === undefined ? undefined : wrapSlotContent(arg.name, content);
}
