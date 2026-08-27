import type { Options } from '../../types/index.ts';

import {
  getToolAvailability,
  type GetToolAvailabilityOptions,
  type ToolAvailability,
} from './availability.ts';
import { frameworkToRendererMap } from './content/framework-renderer.ts';

export type SkillInputs = ToolAvailability & { framework: string; renderer?: string };

/**
 * The one probing path for skill-content assembly: everything the pure builders need, resolved
 * from the target Storybook's presets. Both the skills CLI and addon-mcp fill builder inputs from
 * this, so the two channels cannot drift.
 */
export async function resolveSkillInputs(
  options: Options,
  opts: GetToolAvailabilityOptions = {}
): Promise<SkillInputs> {
  const [availability, frameworkPreset] = await Promise.all([
    getToolAvailability(options, opts),
    options.presets.apply('framework'),
  ]);
  const framework =
    typeof frameworkPreset === 'string' ? frameworkPreset : (frameworkPreset?.name ?? '');
  return { ...availability, framework, renderer: frameworkToRendererMap[framework] };
}
