import type { ToolsetCtx } from './toolset-definition.ts';

/**
 * Maps a toolset method to the MCP tool name that exposes it.
 *
 * These names are the public MCP contract of `@storybook/addon-mcp` and `@storybook/mcp`: clients
 * and downstream integrations call them by name, so they are frozen independently of the method
 * names they point at. Both adapters register from this map, and descriptions render
 * cross-references through {@link getRef}, so description prose and registration cannot disagree.
 */
export const MCP_TOOL_NAMES = {
  'stories.preview': 'preview-stories',
  'stories.changed': 'get-changed-stories',
  'stories.findByComponent': 'get-stories-by-component',
  'test.run': 'run-story-tests',
  'review.create': 'display-review',
  'docs.list': 'list-all-documentation',
  'docs.show': 'get-documentation',
  'docs.showStory': 'get-documentation-for-story',
} as const;

export type ToolsetMethodRef = keyof typeof MCP_TOOL_NAMES;

/**
 * MCP tool titles, frozen alongside {@link MCP_TOOL_NAMES}.
 *
 * A title is display metadata for one surface rather than a description of the capability, which is
 * why it lives with the names instead of on the method.
 */
export const MCP_TOOL_TITLES: Record<ToolsetMethodRef, string> = {
  'stories.preview': 'Get story preview URLs',
  'stories.changed': 'Get changed stories metadata',
  'stories.findByComponent': 'Get stories for component files',
  'test.run': 'Storybook Tests',
  'review.create': 'Display Storybook review',
  'docs.list': 'List All Documentation',
  'docs.show': 'Get Documentation',
  'docs.showStory': 'Get Documentation for Story',
};

/** `stories.findByComponent` -> `stories find-by-component`. */
function toCliPath(method: ToolsetMethodRef): string {
  const [toolsetId, methodName] = method.split('.');
  const kebabMethod = methodName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return `${toolsetId} ${kebabMethod}`;
}

/**
 * Renders a reference to a sibling method in the consumer's own vocabulary.
 *
 * Descriptions that tell an agent to call another tool must name it the way that agent can call it,
 * so never hardcode a tool name or a command in description prose — use this instead.
 */
export function getRef(context: Pick<ToolsetCtx, 'consumer'>) {
  return (method: ToolsetMethodRef): string =>
    context.consumer === 'mcp'
      ? MCP_TOOL_NAMES[method]
      : `npx storybook tools ${toCliPath(method)}`;
}
