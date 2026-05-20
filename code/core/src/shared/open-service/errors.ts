import type { StandardSchemaV1 } from '@standard-schema/spec';

import { Category, StorybookError } from '../../server-errors.ts';

/** Identifies which operation surface produced a validation failure. */
export type OperationKind = 'query' | 'command';

/**
 * Describes the operation and validation phase associated with a schema failure.
 */
export type ValidationMeta = {
  kind: OperationKind;
  serviceId: string;
  name: string;
  phase: 'input' | 'output';
};

/**
 * Formats a schema issue path into the field notation shown in validation errors.
 *
 * Examples:
 * - `['foo']` -> `foo`
 * - `['items', 0, 'id']` -> `items[0].id`
 */
function formatIssuePath(path?: readonly (PropertyKey | StandardSchemaV1.PathSegment)[]): string {
  if (!path?.length) {
    return '';
  }

  return path
    .map((segment) => {
      const key =
        typeof segment === 'object' && segment !== null && 'key' in segment ? segment.key : segment;

      return typeof key === 'number' ? `[${key}]` : `.${String(key)}`;
    })
    .join('')
    .replace(/^\./, '');
}

/**
 * Converts schema issues into the newline-separated detail block appended to user-facing errors.
 */
function formatIssues(issues: ReadonlyArray<StandardSchemaV1.Issue>): string {
  return issues
    .map((issue) => {
      const path = formatIssuePath(issue.path);
      return path === '' ? issue.message : `${path}: ${issue.message}`;
    })
    .join('\n');
}

/**
 * Raised when query or command input/output does not satisfy its declared Standard Schema.
 *
 * The message intentionally includes the operation kind, validation phase, fully qualified service
 * name, and one line per schema issue so callers can act on failures without additional logging.
 */
export class OpenServiceValidationError extends StorybookError {
  constructor(public data: ValidationMeta & { issues: ReadonlyArray<StandardSchemaV1.Issue> }) {
    super({
      name: 'OpenServiceValidationError',
      category: Category.CORE_COMMON,
      code: 1001,
      message: `Invalid ${data.phase} for ${data.kind} "${data.serviceId}.${data.name}":\n${formatIssues(
        data.issues
      )}`,
    });
  }
}
