import type { AIInstructionSnippets, Options } from '../../types/index.ts';
import { extractFrameworkPackageName } from '../../common/utils/get-framework-name.ts';

import {
  getToolAvailability,
  type GetToolAvailabilityOptions,
  type ToolAvailability,
} from './availability.ts';
import { resolveAIInstructions } from './ai-instructions.ts';
import { frameworkToRendererMap } from './content/framework-renderer.ts';

export type SkillInputs = ToolAvailability & {
  framework: string;
  renderer?: string;
  aiInstructions?: AIInstructionSnippets;
};

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
  const framework = extractFrameworkPackageName(
    typeof frameworkPreset === 'string' ? frameworkPreset : (frameworkPreset?.name ?? '')
  );
  const aiInstructions = await resolveAIInstructions(options, framework);
  return {
    ...availability,
    framework,
    renderer: frameworkToRendererMap[framework],
    aiInstructions,
  };
}
