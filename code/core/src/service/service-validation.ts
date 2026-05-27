/**
 * Schema-validation utilities for the service runtime.
 *
 * Every query and command declares Standard Schema v1 `input` and `output` schemas. The
 * runtime calls these helpers at the boundary — incoming caller input is validated before the
 * handler runs; the returned value is validated before it leaves the service. Schema
 * mismatches surface as `ServiceValidationError`s.
 */

import type { StandardSchemaV1 } from '@standard-schema/spec';

import type { AnySchema } from './types.ts';

/** Where in a service-operation lifecycle a validation failure originated. */
export type ValidationKind = 'query' | 'command';
export type ValidationPhase = 'input' | 'output';

/**
 * A schema-validation failure thrown by the runtime. Carries the service id, operation kind
 * (`query` | `command`), operation name, phase (`input` | `output`), and the raw issues
 * produced by the schema. The message renders a human-readable summary so authors don't have
 * to dig into `issues` for routine failures.
 */
export class ServiceValidationError extends Error {
  readonly serviceId: string;
  readonly kind: ValidationKind;
  /** Operation name (`queries.foo` / `commands.bar`), not the Error class name. */
  readonly operationName: string;
  readonly phase: ValidationPhase;
  readonly issues: ReadonlyArray<StandardSchemaV1.Issue>;

  constructor(meta: {
    serviceId: string;
    kind: ValidationKind;
    name: string;
    phase: ValidationPhase;
    issues: ReadonlyArray<StandardSchemaV1.Issue>;
  }) {
    const detail = formatIssues(meta.issues);
    const header = `Invalid ${meta.phase} for ${meta.kind} "${meta.serviceId}.${meta.name}"`;
    super(detail ? `${header}:\n${detail}` : header);
    this.name = 'ServiceValidationError';
    this.serviceId = meta.serviceId;
    this.kind = meta.kind;
    this.operationName = meta.name;
    this.phase = meta.phase;
    this.issues = meta.issues;
  }
}

/**
 * Synchronously validate a value against a Standard Schema. Returns the parsed value on success,
 * throws `ServiceValidationError` on failure.
 *
 * We deliberately don't `await` a possibly-async schema here — synchronous schemas (the common
 * case for zod's `z.string()`, `z.number()`, etc.) keep the runtime hot path branch-free. If a
 * schema returns a Promise, that's an authoring bug and we throw an obvious error.
 */
export function validateSync<S extends AnySchema>(
  schema: S,
  value: unknown,
  meta: { serviceId: string; kind: ValidationKind; name: string; phase: ValidationPhase }
): StandardSchemaV1.InferOutput<S> {
  const result = schema['~standard'].validate(value);
  if (result instanceof Promise) {
    throw new Error(
      `[service ${meta.serviceId}] ${meta.kind} "${meta.name}" uses an async Standard Schema for ${meta.phase}; only synchronous schemas are supported on this path.`
    );
  }
  if (result.issues) {
    throw new ServiceValidationError({ ...meta, issues: result.issues });
  }
  return result.value as StandardSchemaV1.InferOutput<S>;
}

/**
 * Async-friendly validate. Used on command paths where the handler is allowed to be async,
 * so we may as well await an async schema too.
 */
export async function validateAsync<S extends AnySchema>(
  schema: S,
  value: unknown,
  meta: { serviceId: string; kind: ValidationKind; name: string; phase: ValidationPhase }
): Promise<StandardSchemaV1.InferOutput<S>> {
  const result = await schema['~standard'].validate(value);
  if (result.issues) {
    throw new ServiceValidationError({ ...meta, issues: result.issues });
  }
  return result.value as StandardSchemaV1.InferOutput<S>;
}

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
 * Render Standard Schema issues into a newline-separated detail block. Path segments are
 * concatenated dotted/indexed (`items[0].id`); empty paths emit just the message.
 */
export function formatIssues(issues: ReadonlyArray<StandardSchemaV1.Issue>): string {
  return issues
    .map((issue) => {
      const path = formatIssuePath(issue.path);
      return path === '' ? issue.message : `${path}: ${issue.message}`;
    })
    .join('\n');
}

function formatIssuePath(path?: readonly (PropertyKey | StandardSchemaV1.PathSegment)[]): string {
  if (!path?.length) return '';
  return path
    .map((segment) => {
      const key =
        typeof segment === 'object' && segment !== null && 'key' in segment ? segment.key : segment;
      return typeof key === 'number' ? `[${key}]` : `.${String(key)}`;
    })
    .join('')
    .replace(/^\./, '');
}
