import { logger } from 'storybook/internal/client-logger';

let warnedRedundant = false;

/** Hand Compodoc's `documentation.json` to the Angular preview so Controls and Docs can read it. */
export const setCompodocJson = (compodocJson: any) => {
  // Storybook extracts Angular metadata on the server under this feature, and reads neither this
  // value nor Compodoc itself.
  if (globalThis.FEATURES?.experimentalDocgenServer) {
    if (!warnedRedundant) {
      warnedRedundant = true;
      logger.warn(
        'setCompodocJson() had no effect: with the experimentalDocgenServer feature enabled, Storybook extracts Angular metadata on the server and never reads Compodoc output. You can delete the setCompodocJson call and the documentation.json import from your preview config.'
      );
    }
    return;
  }

  (globalThis as any).__STORYBOOK_COMPODOC_JSON__ = compodocJson;
};
