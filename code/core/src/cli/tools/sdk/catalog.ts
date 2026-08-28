import {
  resolveToolsetDescription,
  type AnyToolsetDefinition,
  type ToolsetCtx,
} from '../../../shared/open-service/toolset-definition.ts';
import type { ToolsetMethodId } from '../../../shared/open-service/toolset-names.ts';
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
  ctx: ToolsetCtx
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
