import { fileURLToPath } from 'node:url';

import type { StorybookConfigRaw } from '@storybook/core/internal/types';

/** List the React preview entries that the docs and RSC configuration enable. */
export function getPreviewAnnotations(
  docs: StorybookConfigRaw['docs'],
  features: StorybookConfigRaw['features']
): string[] {
  return [
    fileURLToPath(import.meta.resolve('@storybook/react/entry-preview')),
    fileURLToPath(import.meta.resolve('@storybook/react/entry-preview-argtypes')),
    ...(Object.keys(docs ?? {}).length > 0
      ? [fileURLToPath(import.meta.resolve('@storybook/react/entry-preview-docs'))]
      : []),
    ...(features?.experimentalRSC
      ? [fileURLToPath(import.meta.resolve('@storybook/react/entry-preview-rsc'))]
      : []),
  ];
}
