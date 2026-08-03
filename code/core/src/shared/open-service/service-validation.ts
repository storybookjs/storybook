import type { StandardSchemaV1 } from '@standard-schema/spec';

import { OpenServiceAsyncSchemaError, OpenServiceValidationError } from '../../server-errors.ts';
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
  meta: Omit<ValidationMeta, 'issues'>
): Promise<StandardSchemaV1.InferOutput<TSchema>> {
  const validationResult = await schema['~standard'].validate(value);

  if (validationResult.issues) {
    throw new OpenServiceValidationError({ ...meta, issues: validationResult.issues });
  }

  return validationResult.value;
}

/**
 * Synchronous variant of `validateSchema` used on the sync query call path.
 *
 * Query input and output schemas must produce sync validation results so the public `query(input)`
 * function can return a value immediately. If a schema accidentally returns a Promise, the runtime
 * surfaces a dedicated error instead of silently switching to async behavior.
 */
export function validateSchemaSync<TSchema extends AnySchema>(
  schema: TSchema,
  value: unknown,
  meta: Omit<ValidationMeta, 'issues'>
): StandardSchemaV1.InferOutput<TSchema> {
  const validationResult = schema['~standard'].validate(value);

  if (validationResult instanceof Promise) {
    throw new OpenServiceAsyncSchemaError({
      kind: meta.kind,
      serviceId: meta.serviceId,
      name: meta.name,
      phase: meta.phase,
    });
  }

  if (validationResult.issues) {
    throw new OpenServiceValidationError({ ...meta, issues: validationResult.issues });
  }

  return validationResult.value;
}
