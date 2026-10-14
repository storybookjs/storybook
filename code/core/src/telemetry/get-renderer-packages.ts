// Maps a Storybook renderer package (as reported by `getFrameworkInfo`'s `renderer` field, e.g.
// `@storybook/react`) to the UI framework runtime packages whose installed versions are relevant
// for telemetry. Keying off the detected renderer — rather than matching the project's declared
// dependencies — keeps monorepos from reporting sibling frameworks (e.g. a hoisted `vue` in a
// react project). Renderers with no separate runtime package (e.g. `@storybook/html`,
// `@storybook/server`) are intentionally absent.
const RENDERER_RUNTIME_PACKAGES: Record<string, string[]> = {
  '@storybook/react': ['react', 'react-dom'],
  '@storybook/react-native': ['react-native', 'react'],
  '@storybook/angular': ['@angular/core', '@angular-devkit/build-angular'],
  '@storybook/vue3': ['vue'],
  '@storybook/svelte': ['svelte'],
  '@storybook/preact': ['preact'],
  '@storybook/web-components': ['lit'],
  '@storybook/ember': ['ember-source'],
  'storybook-framework-qwik': ['@builder.io/qwik'],
  'storybook-solidjs-vite': ['solid-js'],
};

/**
 * @param renderer The renderer package name as reported by `getFrameworkInfo` (e.g.
 *   `@storybook/react`)
 * @returns The runtime package names whose installed versions telemetry should resolve; empty when
 *   the renderer has no separate runtime packages or isn't recognized
 */
export function getRendererPackages(renderer: string | undefined): string[] {
  if (!renderer) {
    return [];
  }
  return RENDERER_RUNTIME_PACKAGES[renderer] ?? [];
}
