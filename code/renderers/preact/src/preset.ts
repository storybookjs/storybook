import type { PresetProperty } from 'storybook/internal/types';

import { createPreviewAnnotations } from 'storybook/internal/common';

export const previewAnnotations: PresetProperty<'previewAnnotations'> =
  createPreviewAnnotations('@storybook/preact');

/**
 * Alias react and react-dom to preact/compat similar to the preact vite preset
 * https://github.com/preactjs/preset-vite/blob/main/src/index.ts#L238-L239
 */
export const resolvedReact = async (existing: any) => {
  try {
    return {
      ...existing,
      react: 'preact/compat',
      reactDom: 'preact/compat',
    };
  } catch (e) {
    return existing;
  }
};

export const optimizeViteDeps = ['preact/compat/jsx-runtime', '@storybook/react-dom-shim'];
