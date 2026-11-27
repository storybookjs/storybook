import { rendererPackages, rendererRegistry } from 'storybook/internal/common';

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
  return rendererName ? rendererRegistry[rendererName].runtimePackages : [];
}
