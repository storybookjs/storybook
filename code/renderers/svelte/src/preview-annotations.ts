import { fileURLToPath } from 'node:url';

/** List the preview entries the renderer contributes, adding the docs entry when docs are on. */
export function getPreviewAnnotations(docsEnabled: boolean): string[] {
  return [
    fileURLToPath(import.meta.resolve('@storybook/svelte/entry-preview')),
    ...(docsEnabled
      ? [fileURLToPath(import.meta.resolve('@storybook/svelte/entry-preview-docs'))]
      : []),
  ];
}
