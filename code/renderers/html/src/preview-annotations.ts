import { fileURLToPath } from 'node:url';

import type { StorybookConfigRaw } from '@storybook/core/internal/types';

/** List the HTML preview entries that the docs configuration enables. */
export function getPreviewAnnotations(docs: StorybookConfigRaw['docs']): string[] {
  return [
    fileURLToPath(import.meta.resolve('@storybook/html/entry-preview')),
    ...(Object.keys(docs ?? {}).length > 0
      ? [fileURLToPath(import.meta.resolve('@storybook/html/entry-preview-docs'))]
      : []),
  ];
}
