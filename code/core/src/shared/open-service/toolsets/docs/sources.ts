/**
 * Composed Storybook sources.
 *
 * A composition serves several Storybooks through one MCP endpoint: the local one plus every
 * `refs` entry. Each source is read independently, so one unreachable or private source degrades
 * to a message in its own section rather than failing the whole listing.
 */

import type { AllManifests } from './manifest-formatter/manifest-types.ts';

/** One Storybook in a composition. The local source has no `url`. */
export type Source = {
  /** Stable identifier, used as the `storybookId` tool input. */
  id: string;
  /** Human-readable title, used as the section header when listing. */
  title: string;
  /** Remote URL; undefined for the local Storybook. */
  url?: string;
};

export type SourceWithUrl = Source & { url: string };

/** Guidance for a source that can only be read through its own MCP endpoint. */
export type RequiresOwnMcpNotice = {
  kind: 'requires-own-mcp';
  endpoint: string;
};

/**
 * One source's contribution to a composed listing. Exactly one of `manifests`, `error` or `notice`
 * carries the outcome, so a failing source occupies its own section instead of the whole listing.
 */
export type SourceListing = {
  source: Source;
  manifests?: AllManifests;
  error?: string;
  notice?: RequiresOwnMcpNotice;
};

export function getSourceMcpEndpoint(source: SourceWithUrl): string {
  const base = new URL(source.url);
  base.pathname = `${base.pathname.replace(/\/$/, '')}/`;
  return new URL('mcp', base).toString();
}

/**
 * A private composed Storybook cannot be proxied — its credentials belong to the user, not to this
 * server — so the answer is the address the agent should talk to instead.
 */
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

export class RequiresOwnMcpError extends Error {
  public readonly source: SourceWithUrl;
  public readonly endpoint: string;

  constructor(source: SourceWithUrl) {
    const endpoint = getSourceMcpEndpoint(source);
    super(`Composed Storybook "${source.title}" requires its own MCP endpoint: ${endpoint}`);
    this.name = 'RequiresOwnMcpError';
    this.source = source;
    this.endpoint = endpoint;
  }
}

/** Thrown when a manifest cannot be fetched or does not parse. */
export class ManifestGetError extends Error {
  public readonly url: string;
  public override readonly cause?: Error;

  constructor(message: string, url?: string, cause?: Error) {
    super(message);
    this.name = 'ManifestGetError';
    this.url = url ?? 'No source URL provided';
    this.cause = cause;
  }
}
