import type { StorybookConfigRaw } from '@storybook/core/internal/types';

import { fileURLToPath } from 'node:url';

/** List the Web Components preview entries that the docs configuration enables. */
export function getPreviewAnnotations(docs: StorybookConfigRaw['docs']): string[] {
  return [
    fileURLToPath(import.meta.resolve('@storybook/web-components/entry-preview')),
    fileURLToPath(import.meta.resolve('@storybook/web-components/entry-preview-argtypes')),
    ...(Object.keys(docs ?? {}).length > 0
      ? [fileURLToPath(import.meta.resolve('@storybook/web-components/entry-preview-docs'))]
      : []),
  ];
}
