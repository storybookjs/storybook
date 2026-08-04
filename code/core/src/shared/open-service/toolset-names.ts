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
 * `findByComponent` -> `find-by-component`.
 *
 * The one authority for how a method name is spelled on the CLI; the `storybook tools` command
 * derives its dispatch and help from this so command names and description cross-references cannot
 * disagree.
 */
export function toCliMethodName(methodName: string): string {
  return methodName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** `stories.findByComponent` -> `stories find-by-component`. */
function toCliPath(method: ToolsetMethodRef): string {
  const [toolsetId, methodName] = method.split('.');
  return `${toolsetId} ${toCliMethodName(methodName)}`;
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
