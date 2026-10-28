import {
  resolveToolsetDescription,
  type AnyToolsetDefinition,
  type ToolsetBaseCtx,
} from '@storybook/core/open-service';
import type { ToolsetMethodId } from '@storybook/core/open-service';
import { toToolsetJsonSchema } from './json-schema.ts';
import type { ToolsetCatalogEntry } from './types.ts';

/**
 * Describe one toolset for the SDK catalog: prose from the definition, schemas as JSON Schema.
 *
 * Descriptions are resolved against `ctx` because a method may spell sibling-tool references per
 * transport, so a catalog always reads in the vocabulary of the transport that produced it.
 */
export function toCatalogEntry(
  toolset: AnyToolsetDefinition,
  ctx: ToolsetBaseCtx
): ToolsetCatalogEntry {
  return {
    id: toolset.id,
    description: toolset.description,
    methods: Object.entries(toolset.methods).map(([methodName, method]) => ({
      ref: `${toolset.id}.${methodName}` as ToolsetMethodId,
      title: method.title,
      description: resolveToolsetDescription(method.description, ctx).trim(),
      requiresDevServer: method.requiresDevServer === true,
      input: toToolsetJsonSchema(method.input),
      ...(method.output ? { output: toToolsetJsonSchema(method.output) } : {}),
    })),
  };
}
