import type { Source } from '../types.ts';

type SourceWithUrl = Source & { url: string };

export function getSourceMcpEndpoint(source: SourceWithUrl): string {
  const base = new URL(source.url);
  base.pathname = `${base.pathname.replace(/\/$/, '')}/`;
  return new URL('mcp', base).toString();
}

export function formatRequiresOwnMcpNotice(
  source: Source,
  endpoint: string,
  options: { includeHeader?: boolean } = {}
): string {
  const parts: string[] = [];

  if (options.includeHeader ?? true) {
    parts.push(`# ${source.title}`);
    parts.push(`id: ${source.id}`);
    parts.push('');
  }

  parts.push(
    'This composed Storybook is private and cannot be read through the local Storybook MCP proxy.'
  );
  parts.push('');
  parts.push("Use this source's own MCP endpoint instead:");
  parts.push(endpoint);

  return parts.join('\n');
}
