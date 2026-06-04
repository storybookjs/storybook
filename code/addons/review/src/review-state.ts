/**
 * The review payload an agent pushes via the `display-review` MCP tool.
 *
 * Flow:
 *   MCP `display-review` tool → emit PUSH_REVIEW on the Storybook channel
 *   → this addon's server preset enriches with `branchName` and caches it
 *   → emits DISPLAY_REVIEW to all open tabs (or replays on REQUEST_REVIEW).
 *
 * This mirrors the canonical valibot schema in `@storybook/addon-mcp` →
 * `tools/display-review.ts`. This side only renders the data — it does
 * not validate — so it needs the type, not the validator. Keep `title` /
 * `description` / `collections` in sync with that schema.
 */

export type CollectionKind = 'atomic' | 'consumer' | 'transitive' | 'catch-all';

export interface ReviewCollection {
  title: string;
  rationale: string;
  storyIds: string[];
  kind?: CollectionKind;
}

export interface ReviewState {
  title: string;
  description: string;
  collections: ReviewCollection[];
  changedFiles?: string[];
  /**
   * Current git branch of the target repo, resolved server-side by this
   * addon's preset; not part of the agent's MCP payload.
   */
  branchName?: string;
  /**
   * Server-side creation timestamp (unix ms) assigned when PUSH_REVIEW is
   * received; used for live "Created x minutes ago" UI in the summary.
   */
  createdAt?: number;
  /**
   * Whether a baseline is available to compare against. Enables the
   * baseline/latest comparison controls on the detail screen. The baseline
   * source itself is provided on a separate branch; until then this stays
   * unset and the controls are hidden.
   */
  hasBaseline?: boolean;
}
