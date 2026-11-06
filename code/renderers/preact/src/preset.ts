import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

export const previewAnnotations: PresetProperty<'previewAnnotations'> = async (
  input = [],
  options
) => {
  const docsEnabled = Object.keys(await options.presets.apply('docs', {}, options)).length > 0;
  const result: string[] = [];

  return result
    .concat(input)
    .concat([fileURLToPath(import.meta.resolve('@storybook/preact/entry-preview'))])
    .concat(
      docsEnabled
        ? [fileURLToPath(import.meta.resolve('@storybook/preact/entry-preview-docs'))]
        : []
    );
};

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

export const optimizeViteDeps = [
  // The renderer's entry preview imports `preact` by its bare specifier. Vite's dependency scan
  // skips files under `dist/` (the default `build.outDir`), so it never registers that import, and
  // Vite does not discover deps imported from `node_modules` at runtime either. Without this entry
  // the renderer loads raw `preact` while stories that import `preact/hooks` get a pre-bundled copy
  // of Preact, and every hook throws `Cannot read properties of null (reading '__H')`. Projects
  // using `@preact/preset-vite` were unaffected because that plugin pre-bundles `preact` itself.
  'preact',
  'preact/compat/jsx-runtime',
];
