import { kebabCase } from 'es-toolkit/string';

import type { ToolsetCtx } from './toolset-definition.ts';

export type ToolsetMethodId = `${string}.${string}`;

/**
 * Split `toolsetId.methodName` into parts. Rejects empty segments and anything that is not exactly
 * one separator (no truncation of `a.b.c`).
 *
 * Throws a plain `Error` so this module stays portable for `storybook/internal/toolsets-docs`.
 * Registration adapters wrap with `OpenServiceInvalidToolsetMethodIdError` where appropriate.
 */
export function parseToolsetMethodId(methodId: string): {
  toolsetId: string;
  methodName: string;
} {
  const separator = methodId.indexOf('.');
  if (
    separator <= 0 ||
    separator !== methodId.lastIndexOf('.') ||
    separator === methodId.length - 1
  ) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors -- portable toolsets-docs path
    throw new Error(
      `Invalid toolset method id "${methodId}". Expected exactly one separator: toolsetId.methodName.`
    );
  }
  return {
    toolsetId: methodId.slice(0, separator),
    methodName: methodId.slice(separator + 1),
  };
}

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
  const { toolsetId, methodName } = parseToolsetMethodId(method);
  return `${toolsetId} ${toCliMethodName(methodName)}`;
}

/** `stories.findByComponent` -> `stories-find-by-component`. */
export function toMcpToolName(method: ToolsetMethodId): string {
  const { toolsetId, methodName } = parseToolsetMethodId(method);
  return `${kebabCase(toolsetId)}-${toCliMethodName(methodName)}`;
}

/**
 * Renders how a toolset method is spelled for the active transport.
 *
 * Not a composed-Storybook "ref" (`refs` in `main.js`) — the name is the invokable tool/command
 * string agents see. Descriptions that tell an agent to call another tool must use this rather
 * than hardcoding either spelling.
 */
export function getToolName(context: Pick<ToolsetCtx, 'transport'>) {
  return (method: ToolsetMethodId): string => {
    switch (context.transport) {
      case 'mcp':
        return toMcpToolName(method);
      case 'cli':
        return `npx storybook tools ${toCliPath(method)}`;
      case 'sdk':
        return method;
      default: {
        const exhaustive: never = context.transport;
        return exhaustive;
      }
    }
  };
}
