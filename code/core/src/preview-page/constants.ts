import { join } from 'pathe';

/** Select the HMR API and module wiring of the generated preview modules. */
export type PreviewHmr = 'vite' | 'webpack';

/** Name a generated preview module or the builder-owned story importer. */
export type PreviewModuleName = keyof typeof PREVIEW_MODULE_FILES;

/** File names of the preview modules; Webpack-style builders place them in the working directory. */
export const PREVIEW_MODULE_FILES = {
  entry: 'storybook-config-entry.js',
  projectAnnotations: 'storybook-project-annotations.js',
  addonSetup: 'storybook-setup-addons.js',
  importFn: 'storybook-stories.js',
} as const;

/** Vite virtual ids of the preview modules; addon-vitest imports the project annotations id. */
export const VITE_PREVIEW_MODULE_IDS = {
  entry: 'virtual:/@storybook/builder-vite/vite-app.js',
  projectAnnotations: 'virtual:/@storybook/builder-vite/project-annotations.js',
  addonSetup: 'virtual:/@storybook/builder-vite/setup-addons.js',
  importFn: 'virtual:/@storybook/builder-vite/storybook-stories.js',
} as const satisfies Record<PreviewModuleName, string>;

/** Resolve the module ids the generated preview modules import each other by. */
export function getPreviewModuleIds(
  hmr: PreviewHmr,
  workingDir: string
): Record<PreviewModuleName, string> {
  if (hmr === 'vite') {
    return { ...VITE_PREVIEW_MODULE_IDS };
  }
  return {
    entry: join(workingDir, PREVIEW_MODULE_FILES.entry),
    projectAnnotations: join(workingDir, PREVIEW_MODULE_FILES.projectAnnotations),
    addonSetup: join(workingDir, PREVIEW_MODULE_FILES.addonSetup),
    importFn: join(workingDir, PREVIEW_MODULE_FILES.importFn),
  };
}
