import type { ToolsetCtx } from '../../../shared/open-service/toolset-definition.ts';

import type { SkillId } from './skills.ts';

export type SkillConsumer = ToolsetCtx['consumer'];

/**
 * The MCP tool that serves a skill's content, for skills that have one. Frozen contract: the name
 * must match `GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME` in addon-mcp's `tools/tool-names.ts`.
 */
const MCP_SKILL_TOOL_NAMES: Partial<Record<SkillId, string>> = {
  'write-story': 'get-storybook-story-instructions',
};

/**
 * Renders a cross-reference to a skill in the consumer's own vocabulary, mirroring `getRef` for
 * toolset methods: the MCP tool name where one exists, the `skills get` command otherwise.
 */
export function getSkillRef(consumer: SkillConsumer) {
  return (id: SkillId): string =>
    (consumer === 'mcp' && MCP_SKILL_TOOL_NAMES[id]) || `npx storybook skills get ${id}`;
}
