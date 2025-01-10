import { NoMatchingExportError } from '@storybook/core/server-errors';

export async function buildOrThrow<T>(callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch (err: any) {
    const builderErrors = err.errors as { text: string }[];
    if (builderErrors) {
      const inconsistentVersionsError = builderErrors.find((er) =>
        er.text?.includes('No matching export')
      );

      if (inconsistentVersionsError) {
        throw new NoMatchingExportError(err);
      }
    }

    throw err;
  }
}
