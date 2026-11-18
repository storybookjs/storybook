import { NoMatchingExportError } from 'storybook/internal/server-errors';

import { GLOBAL_MODULE_PREFIX } from '../../builder-manager/utils/global-externals.ts';

export async function buildOrThrow<T>(callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch (err: any) {
    // Rolldown's error for a manager entry that imports what this version of Storybook lacks.
    const builderErrors = err.errors as { code?: string; exporter?: string }[] | undefined;
    if (
      builderErrors?.some(
        (error) =>
          error.code === 'MISSING_EXPORT' && error.exporter?.startsWith(GLOBAL_MODULE_PREFIX)
      )
    ) {
      throw new NoMatchingExportError(err);
    }

    throw err;
  }
}
