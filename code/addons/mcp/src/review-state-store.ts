/**
 * In-memory store for the agent-pushed review state.
 *
 * The agent pushes a review via the `apply-review-state` MCP tool; the last
 * one is cached here in module scope and replayed over the Storybook channel
 * to any tab that asks (the `request-review-state` event). A dev-server
 * restart clears it — server memory only, by design.
 *
 * This module owns the canonical valibot schema for the review contract;
 * `@storybook/addon-review-changes` duplicates the inferred TS shape on its
 * side (it only renders, so it needs the type, not the validator).
 */
import * as v from 'valibot';

export const ReviewClusterSchema = v.object({
	label: v.pipe(
		v.string(),
		v.description('Short human-readable cluster name, e.g. "Direct Button importers".'),
	),
	rationale: v.pipe(
		v.string(),
		v.description('One sentence explaining why these stories are grouped together.'),
	),
	sampleStoryIds: v.pipe(
		v.array(v.string()),
		v.description(
			'Story IDs that represent this cluster (e.g. "button--primary"). The page renders exactly these.',
		),
	),
	kind: v.pipe(
		v.optional(v.picklist(['atomic', 'consumer', 'transitive', 'catch-all'])),
		v.description(
			'Semantic role of this cluster in the change cascade: "atomic" = the directly changed component, "consumer" = direct dependents, "transitive" = pages/containers further away, "catch-all" = everything else. Omit if unknown.',
		),
	),
});

const StoryMetaSchema = v.object({
	depth: v.pipe(
		v.optional(v.number()),
		v.description(
			'Graph distance from the changed file(s) to this story (0 = the changed component itself).',
		),
	),
	chain: v.pipe(
		v.optional(v.array(v.string())),
		v.description(
			'Ordered intermediate file paths between the story file and the changed file, excluding both endpoints. Empty/omitted means a direct import.',
		),
	),
});

const DiffHunkSchema = v.object({
	path: v.pipe(v.string(), v.description('Path of the changed file this hunk belongs to.')),
	hunk: v.pipe(
		v.string(),
		v.description('Unified-diff text for this hunk (with +/- line prefixes).'),
	),
});

export const ReviewStateSchema = v.object({
	narrative: v.pipe(
		v.string(),
		v.description('One-paragraph overview of what changed and where to start.'),
	),
	clusters: v.array(ReviewClusterSchema),
	changedFiles: v.pipe(
		v.optional(v.array(v.string())),
		v.description('Paths of the files you changed, most central first.'),
	),
	diffHunks: v.pipe(
		v.optional(v.array(DiffHunkSchema)),
		v.description('The actual diff hunks of your change, shown in the review page.'),
	),
	storyMeta: v.pipe(
		v.optional(v.record(v.string(), StoryMetaSchema)),
		v.description('Optional per-story metadata keyed by story ID: { depth, chain }.'),
	),
});

export type ReviewCluster = v.InferOutput<typeof ReviewClusterSchema>;
export type ReviewState = v.InferOutput<typeof ReviewStateSchema>;

let cached: ReviewState | undefined;

export function setReviewState(state: ReviewState): void {
	cached = state;
}

export function getReviewState(): ReviewState | undefined {
	return cached;
}
