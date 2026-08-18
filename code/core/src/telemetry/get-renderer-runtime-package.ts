// Maps a Storybook renderer package (as reported by `getFrameworkInfo`'s `renderer` field, e.g.
// `@storybook/react`) to the underlying UI framework runtime package whose installed version is
// relevant for telemetry. Renderers with no separate runtime package (e.g. `@storybook/html`,
// `@storybook/server`) are intentionally absent.
const RENDERER_RUNTIME_PACKAGES: Record<string, string> = {
  '@storybook/react': 'react',
  '@storybook/react-native': 'react-native',
  '@storybook/angular': '@angular/core',
  '@storybook/vue3': 'vue',
  '@storybook/svelte': 'svelte',
  '@storybook/preact': 'preact',
  '@storybook/web-components': 'lit',
  '@storybook/ember': 'ember-source',
  'storybook-framework-qwik': '@builder.io/qwik',
  'storybook-solidjs-vite': 'solid-js',
};

/**
 * @param renderer The renderer package name as reported by `getFrameworkInfo` (e.g.
 *   `@storybook/react`)
 * @returns The runtime package name whose version telemetry should resolve, or undefined when the
 *   renderer has no separate runtime package or isn't recognized
 */
export function getRendererRuntimePackage(renderer: string | undefined): string | undefined {
  if (!renderer) {
    return undefined;
  }
  return RENDERER_RUNTIME_PACKAGES[renderer];
}
