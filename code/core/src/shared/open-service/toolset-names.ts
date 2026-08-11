import { kebabCase } from 'es-toolkit/string';

import type { ToolsetCtx } from './toolset-definition.ts';

export type ToolsetMethodId = `${string}.${string}`;

/**
 * `findByComponent` -> `find-by-component`.
 *
 * The one authority for how a method name is spelled on the CLI; the `storybook tools` command
 * derives its dispatch and help from this so command names and description cross-references cannot
 * disagree.
 */
export function toCliMethodName(methodName: string): string {
  return kebabCase(methodName);
}

/** `stories.findByComponent` -> `stories find-by-component`. */
function toCliPath(method: ToolsetMethodId): string {
  const [toolsetId, methodName] = method.split('.');
  return `${toolsetId} ${toCliMethodName(methodName)}`;
}

/** `stories.findByComponent` -> `stories-find-by-component`. */
export function toMcpToolName(method: ToolsetMethodId): string {
  const [toolsetId, methodName] = method.split('.');
  return `${kebabCase(toolsetId)}-${kebabCase(methodName)}`;
}

/**
 * Renders how a toolset method is spelled for the active transport.
 *
 * Not a composed-Storybook "ref" (`refs` in `main.js`) — the name is the invokable tool/command
 * string agents see. Descriptions that tell an agent to call another tool must use this rather
 * than hardcoding either spelling.
 */
export function getToolName(context: Pick<ToolsetCtx, 'transport'>) {
  return (method: ToolsetMethodId): string =>
    context.transport === 'mcp'
      ? toMcpToolName(method)
      : `npx storybook tools ${toCliPath(method)}`;
}
