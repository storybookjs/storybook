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
  /** Import statement for the rendered component tag. */
  componentImportStatement: string;
  /** Classified args to render into the SFC snippet. */
  args: ClassifiedArg[];
  /** Import bindings from the CSF module, used to import components a slot renders. */
  importBindings: Map<string, ImportBinding>;
}

export interface RenderSfcResult {
  /** Vue SFC snippet for the docs payload. */
  snippet: string;
}

/** Render classified CSF args into the same SFC block shape as Vue's runtime source decorator. */
export function renderSfcSnippet(input: RenderSfcInput): RenderSfcResult | undefined {
  const ctx = createRenderContext();
  ctx.componentImports.add(input.componentImportStatement);
  const componentImportStatements = new Map([
    [input.componentName, input.componentImportStatement],
  ]);
  const partitioned = partitionArgsByRole(input.args);
  const props = partitioned.props.map((arg) => formatRenderedProp(renderPropLikeArg(arg, ctx)));
  const events = partitioned.events.map((arg) => formatRenderedProp(renderEventArg(arg, ctx)));

  const slotSource: string[] = [];
  for (const arg of partitioned.slots) {
    const rendered = renderSlotArg(arg, ctx, input.importBindings, componentImportStatements);
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
  };
}

function renderSlotArg(
  arg: ClassifiedSlotArg,
  ctx: RenderContext,
  importBindings: Map<string, ImportBinding>,
  componentImportStatements: Map<string, string>
): string | undefined {
  const content = renderSlotArgContent(arg, ctx, importBindings, componentImportStatements);
  return content === undefined ? undefined : wrapSlotContent(arg.name, content);
}
