import { toJsonSchema } from '@valibot/to-json-schema';

import type { StandardSchemaV1 } from '@standard-schema/spec';

/** A JSON Schema document, as produced from a toolset method's input or output schema. */
export type ToolsetJsonSchema = Record<string, unknown>;

/**
 * Convert one toolset schema to JSON Schema, or return `undefined` when it cannot be converted.
 *
 * Core toolset schemas are valibot, which converts losslessly; a third-party toolset may register
 * another Standard Schema, for which there is no converter. The vendor check is load-bearing: the
 * converter's `ignore` mode turns a foreign schema into an empty object, which would read as a
 * method that takes no arguments — while `ignore` on a genuine valibot schema only drops exotic
 * pipe actions.
 */
export function toToolsetJsonSchema(schema: StandardSchemaV1): ToolsetJsonSchema | undefined {
  if (schema['~standard'].vendor !== 'valibot') {
    return undefined;
  }
  try {
    return toJsonSchema(schema as never, { errorMode: 'ignore' }) as ToolsetJsonSchema;
  } catch {
    return undefined;
  }
}
