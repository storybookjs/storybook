import { Category, StorybookError } from '../server-errors.ts';

/**
 * Thrown by the oxc-parser sub-package whenever parsing fails (parser error, missing module
 * info, worker-thread failure, pool tear-down). Callers that want soft fallback semantics
 * should catch this and decide how to recover; the worker-pool already swallows pool-level
 * failures and falls back to inline parsing in {@link parseWithOxc}.
 */
export class OxcParseError extends StorybookError {
  constructor(message: string, options?: ErrorOptions) {
    super({
      name: 'OxcParseError',
      category: Category.CORE_SERVER,
      code: 17,
      message,
    });
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}
