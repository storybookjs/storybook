import { fileURLToPath } from 'node:url';

import type { StorybookConfigRaw } from '@storybook/core/internal/types';

/** List the Preact preview entries that the docs configuration enables. */
export function getPreviewAnnotations(docs: StorybookConfigRaw['docs']): string[] {
  return [
    fileURLToPath(import.meta.resolve('@storybook/preact/entry-preview')),
    ...(Object.keys(docs ?? {}).length > 0
      ? [fileURLToPath(import.meta.resolve('@storybook/preact/entry-preview-docs'))]
      : []),
  ];
}
