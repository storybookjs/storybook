/**
 * The review payload an agent pushes via the `apply-review-state` MCP tool,
 * delivered to this addon over the Storybook channel.
 *
 * This is a DUPLICATE of the canonical valibot schema in the MCP addon
 * (`@storybook/addon-mcp`). This side only renders the data — it does not
 * validate — so it needs the type, not the validator. All fields beyond
 * `narrative` + `clusters` are optional: the minimal payload is still valid.
 */

export type ClusterKind = 'atomic' | 'consumer' | 'transitive' | 'catch-all';

export interface ReviewCluster {
  label: string;
  rationale: string;
  sampleStoryIds: string[];
  kind?: ClusterKind;
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
  narrative: string;
  clusters: ReviewCluster[];
  changedFiles?: string[];
  diffHunks?: DiffHunk[];
  storyMeta?: Record<string, StoryMeta>;
}
