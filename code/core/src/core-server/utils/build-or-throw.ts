import { NoMatchingExportError } from 'storybook/internal/server-errors';

export interface BuilderErrorMessage {
  text: string;
  /** esbuild sets this on errors that point at a source location, e.g. the importing file. */
  location?: { file?: string };
}

/**
 * Formats the underlying builder error ("No matching export in <module> for import <name>") plus
 * the importing file, when esbuild reported a location, into the detail block shown in the
 * NoMatchingExportError card.
 */
export function formatNoMatchingExportDetail(builderError: BuilderErrorMessage): string {
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
  } catch (err: any) {
    const builderErrors = err?.errors as BuilderErrorMessage[] | undefined;
    const noMatchingExportError = builderErrors?.find((er) =>
      er.text?.includes('No matching export')
    );

    if (noMatchingExportError) {
      throw new NoMatchingExportError({
        error: err,
        detail: formatNoMatchingExportDetail(noMatchingExportError),
      });
    }

    throw err;
  }
}
