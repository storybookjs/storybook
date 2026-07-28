import type { AnyToolsetDefinition } from './definition.ts';

/** Minimal presets surface needed to collect toolset contributions. */
export type ToolsetPresets = {
  apply: <T>(extension: string, config?: T) => Promise<T>;
};

let loadedToolsets: AnyToolsetDefinition[] | undefined;

/**
 * Loads public toolsets from Storybook presets.
 *
 * Core and addons contribute via the `experimental_toolsets` preset property (arrays concat).
 * There is no imperative `registerToolset` helper — export an array (or preset function) from the
 * addon/core preset so dependency direction stays addon → core.
 */
export async function loadToolsets(
  presets: ToolsetPresets,
  defaults: AnyToolsetDefinition[] = []
): Promise<AnyToolsetDefinition[]> {
  const toolsets = await presets.apply<AnyToolsetDefinition[]>('experimental_toolsets', defaults);
  loadedToolsets = toolsets;
  return toolsets;
}

/** Returns toolsets from the last {@link loadToolsets} call, or an empty array before boot. */
export function getLoadedToolsets(): AnyToolsetDefinition[] {
  return loadedToolsets ?? [];
}
