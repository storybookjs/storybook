import type { StandardSchemaV1 } from '@standard-schema/spec';

import { isEqual } from 'es-toolkit/predicate';

import {
  OpenServiceAsyncSchemaError,
  OpenServiceSchemaConversionError,
  OpenServiceValidationError,
} from '../../server-errors.ts';
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

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Open-service schemas validate shape only — they never convert values.
 *
 * Validation runs purely to surface shape errors; the runtime returns the caller's original
 * reference so the reactive deep-signal graph stays referentially stable. To keep that contract
 * honest, in development we compare the schema's normalized output against the original value and
 * throw {@link OpenServiceSchemaConversionError} when a schema transforms, coerces, or injects
 * defaults. The check is skipped in production to keep the hot path allocation-free.
 */
function assertNoConversion(
  original: unknown,
  validated: unknown,
  meta: Omit<ValidationMeta, 'issues'>
): void {
  if (isProduction) {
    return;
  }
  if (!isEqual(original, validated)) {
    throw new OpenServiceSchemaConversionError({
      serviceId: meta.serviceId,
      name: meta.name,
      kind: meta.kind,
      phase: meta.phase,
    });
  }
}

/**
 * Validates a value with a Standard Schema and returns the **original** value unchanged.
 *
 * Schemas are used for shape validation only; their normalized output is intentionally discarded so
 * the runtime preserves referential identity. Any schema issues are wrapped in
 * `OpenServiceValidationError`.
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

  assertNoConversion(value, validationResult.value, meta);

  return value as StandardSchemaV1.InferOutput<TSchema>;
}

/**
 * Synchronous variant of `validateSchema` used on the sync query call path.
 *
 * Query input and output schemas must produce sync validation results so the public `query(input)`
 * function can return a value immediately. If a schema accidentally returns a Promise, the runtime
 * surfaces a dedicated error instead of silently switching to async behavior. Like
 * {@link validateSchema}, the original value is returned unchanged — schemas validate shape only.
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

  assertNoConversion(value, validationResult.value, meta);

  return value as StandardSchemaV1.InferOutput<TSchema>;
}
