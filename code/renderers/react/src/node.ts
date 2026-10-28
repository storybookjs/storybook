import { resolvePackageDir } from '@storybook/core/internal/common';
import { defineRenderer } from '@storybook/core';

import { buildManifests } from './componentManifest/generator.ts';
import type { TypescriptOptions } from './componentManifest/getComponentImports.ts';
import { getArgTypesData } from './componentManifest/reactDocgen/getArgTypesData.ts';
import { getDocgenProvider } from './docgen/provider.ts';
import { createStoryDocsProvider } from './docgen/story-docs-provider.ts';
import { createCsfEnricher } from './enrichCsf.ts';
import { getPreviewAnnotations } from './preview-annotations.ts';
import type { ReactTypes } from './types.ts';

export type { ReactTypes } from './types.ts';

/**
 * Entry previews import React by bare specifier through a virtual module, so a scan that never saw
 * `react` loads its CJS index raw in Vitest browser mode; `react-dom/test-utils` is only imported
 * dynamically, and plugins such as vite-plugin-svgr emit `react/jsx-runtime` mid-run.
 */
const OPTIMIZE_VITE_DEPS = [
  'react',
  'react-dom/client',
  'react-dom/test-utils',
  'react/jsx-runtime',
];

/** Configure React rendering, annotations, and docgen. */
export const react = defineRenderer<void, ReactTypes>(() => ({
  meta: { name: '@storybook/react' },
  setup(storybook): void {
    const typescriptOptions = (): Promise<Partial<TypescriptOptions>> =>
      storybook.callHook('core:typescript:extend', {}) as Promise<Partial<TypescriptOptions>>;
    storybook.hook('preview:annotations:collect', async () =>
      getPreviewAnnotations(
        await storybook.callHook('core:docs:extend', {}),
        await storybook.callHook('core:features:extend', {})
      )
    );
    storybook.hook('core:features:extend', (value) => ({ ...value, componentsManifest: true }));
    storybook.hook('core:docgen-enabled:extend', () => isTypescriptInstalled());
    storybook.hook('core:docgen-providers:collect', () => [getDocgenProvider()]);
    storybook.hook('core:story-docs-provider:extend', (value) =>
      createStoryDocsProvider(value ?? (async () => undefined), typescriptOptions())
    );
    storybook.hook('index:manifests:extend', async (value, ctx) =>
      buildManifests(value ?? {}, {
        manifestEntries: ctx?.manifestEntries ?? [],
        watch: ctx?.watch === true,
        typescriptOptions: await typescriptOptions(),
        // Read the hook, not `storybook.options`, so a call during setup works too.
        features: await storybook.callHook('core:features:extend', undefined),
      })
    );
    storybook.hook(
      'legacy:experimental_enrichCsf:extend',
      () => createCsfEnricher(storybook.options.features),
      'reduce'
    );
    storybook.hook('legacy:resolvedReact:extend', (value) => resolveProjectReact(value), 'reduce');
    storybook.hook(
      'legacy:internal_getArgTypesData:extend',
      async (_value, ctx) =>
        getArgTypesData({
          componentFilePath: ctx?.componentFilePath ?? '',
          componentExportName: ctx?.componentExportName,
          typescriptOptions: ctx?.componentFilePath
            ? ((await storybook.callHook('core:typescript:extend', {})) as Parameters<
                typeof getArgTypesData
              >[0]['typescriptOptions'])
            : {},
        }),
      'reduce'
    );
    storybook.hook('builder:vite-deps:collect', () => OPTIMIZE_VITE_DEPS, 'collect');
  },
}));

export default react;

/** Server docgen runs on the optional `typescript` peer; without it, builder docgen stays on. */
function isTypescriptInstalled(): boolean {
  try {
    import.meta.resolve('typescript');
    return true;
  } catch {
    return false;
  }
}

/** Alias addon-docs' React to the project's copy when the project installs one. */
function resolveProjectReact(existing: Record<string, string> | undefined): Record<string, string> {
  try {
    return {
      ...existing,
      react: resolvePackageDir('react'),
      reactDom: resolvePackageDir('react-dom'),
    };
  } catch {
    return { ...existing };
  }
}
