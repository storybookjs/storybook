/**
 * The review payload an agent pushes via the `display-review` MCP tool,
 * delivered to this addon over the Storybook channel.
 *
 * This mirrors the canonical valibot schema in the MCP addon
 * (`@storybook/addon-mcp` → `review-state-store.ts`). This side only
 * renders the data — it does not validate — so it needs the type, not the
 * validator. Keep `title` / `description` / `collections` in sync with
 * that schema.
 */

export type CollectionKind = 'atomic' | 'consumer' | 'transitive' | 'catch-all';

export interface ReviewCollection {
  title: string;
  rationale: string;
  storyIds: string[];
  kind?: CollectionKind;
}

export interface DiffHunk {
  path: string;
  hunk: string;
}

export interface StoryMeta {
  depth?: number;
  chain?: string[];
}

export interface ReviewState {
  title: string;
  description: string;
  collections: ReviewCollection[];
  /** Optional UI-only field; not part of the MCP payload. */
  branchName?: string;
  changedFiles?: string[];
  diffHunks?: DiffHunk[];
  storyMeta?: Record<string, StoryMeta>;
}
