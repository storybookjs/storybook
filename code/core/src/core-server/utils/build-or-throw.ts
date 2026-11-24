import type { Message } from 'esbuild';

import { NoMatchingExportError } from 'storybook/internal/server-errors';

import { GLOBAL_MODULE_PREFIX } from '../../builder-manager/utils/global-externals.ts';

/**
 * Narrows unknown caught errors to esbuild's build-failure shape. Any builder error carrying an
 * `errors` array is treated as an esbuild-style failure; the text matching below decides whether
 * it is an exports mismatch.
 */
function isEsbuildBuildError(err: unknown): err is { errors: Message[] } {
  return (
    typeof err === 'object' && err !== null && Array.isArray((err as { errors?: unknown }).errors)
  );
}

interface RolldownError {
  code?: unknown;
  message?: unknown;
  id?: unknown;
}

// The first line of the message states the export, and a code frame follows it.
function formatMissingExportDetail({ message, id }: RolldownError): string {
  const [summary] = String(message).replace('[MISSING_EXPORT] ', '').split('\n');
  const lines = [summary.replace(GLOBAL_MODULE_PREFIX, '').trim()];

  if (typeof id === 'string') {
    lines.push(`imported from ${id}`);
  }

  return lines.join('\n');
}

function formatNoMatchingExportDetail(builderError: Message): string {
  const lines = [builderError.text.trim()];
  const file = builderError.location?.file;

  if (file) {
    lines.push(`imported from ${file}`);
  }

  return lines.join('\n');
}

export async function buildOrThrow<T>(callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch (err: unknown) {
    if (isEsbuildBuildError(err)) {
      // `err.errors` entries are not guaranteed to be esbuild Messages: buildOrThrow wraps the
      // whole dev server and static build, so errors like AggregateError (an `errors` array of
      // plain Errors) can land here. Guard on the string before matching or formatting.
      const noMatchingExportErrors = err.errors.filter(
        (er) => typeof er.text === 'string' && er.text.includes('No matching export')
      );

      const missingExportErrors = (err.errors as RolldownError[]).filter(
        (er) => er.code === 'MISSING_EXPORT' && typeof er.message === 'string'
      );
      const details = [
        ...noMatchingExportErrors.map(formatNoMatchingExportDetail),
        ...missingExportErrors.map(formatMissingExportDetail),
      ];

      if (details.length > 0) {
        throw new NoMatchingExportError({ error: err, detail: details.join('\n\n') });
      }
    }

    throw err;
  }
}
