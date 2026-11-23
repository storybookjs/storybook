import { rendererPackages, rendererRegistry } from 'storybook/internal/common';

/**
 * Renderers telemetry recognizes even where the framework tables do not list them, mapped to their
 * runtime packages.
 */
export const TELEMETRY_ONLY_RENDERER_PACKAGES: Record<string, string[]> = {
  '@storybook-astro/renderer': ['astro'],
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
  const rendererName = rendererPackages[renderer];
  return rendererName
    ? rendererRegistry[rendererName].runtimePackages
    : (TELEMETRY_ONLY_RENDERER_PACKAGES[renderer] ?? []);
}
