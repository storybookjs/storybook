import type { StandardSchemaV1 } from '@standard-schema/spec';

import { OpenServiceValidationError } from './errors.ts';
import type { AnySchema } from './types.ts';
import type { ValidationMeta } from './errors.ts';

/**
 * Re-throws asynchronous subscription failures on the microtask queue so they are not silently
 * swallowed by promise chains started from reactive listeners.
 */
export function rethrowAsync(error: unknown): void {
  queueMicrotask(() => {
    throw error;
  });
}

/**
 * Validates a value with a Standard Schema and returns the parsed output value.
 *
 * Any schema issues are wrapped in `OpenServiceValidationError`, which standardizes the operation
 * metadata while preserving the schema's own expectation text for the actionable details.
 */
export async function validateSchema<TSchema extends AnySchema>(
  schema: TSchema,
  value: unknown,
  meta: ValidationMeta
): Promise<StandardSchemaV1.InferOutput<TSchema>> {
  const validationResult = await schema['~standard'].validate(value);

  if (validationResult.issues) {
    throw new OpenServiceValidationError({ ...meta, issues: validationResult.issues });
  }

  return validationResult.value;
}
