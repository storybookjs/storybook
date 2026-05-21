import type { McpServer } from 'tmcp';
import * as v from 'valibot';
import type { AddonContext } from '../types.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import { ReviewStateSchema, setReviewState, type ReviewState } from '../review-state-store.ts';
import { APPLY_REVIEW_STATE_EVENT, REVIEW_PAGE_PATH } from '../constants.ts';
import { APPLY_REVIEW_STATE_TOOL_NAME } from './tool-names.ts';

const ApplyReviewStateOutput = v.object({
	reviewUrl: v.pipe(
		v.string(),
		v.description(
			'URL of the Storybook review page. Always include this URL in your final user-facing response so the user can open it directly.',
		),
	),
});

export async function addApplyReviewStateTool(server: McpServer<any, AddonContext>) {
	server.tool(
		{
			name: APPLY_REVIEW_STATE_TOOL_NAME,
			title: 'Apply Storybook review state',
			description: `Push a curated review of the current change to Storybook's review page.

After you finish a UI code change, call this to help the user spot-check it. Provide:
- title: a PR-style title for the change — short and specific.
- description: a one-line summary of what changed and where to start reviewing.
- collections: titled groups of representative story IDs. Give each a concise, PR-dense title, a one-sentence rationale, and — when you can tell — a kind ("atomic" for the directly changed component, "consumer" for direct dependents, "transitive" for pages/containers, "catch-all" otherwise).
- changedFiles: the files you edited (most central first).
- diffHunks: the actual diff of your change (you made it — include the hunks).
- storyMeta: optional per-story { depth, chain }.

Always include the returned reviewUrl in your final user-facing response so the user can open it.`,
			schema: ReviewStateSchema,
			outputSchema: ApplyReviewStateOutput,
			enabled: () => server.ctx.custom?.toolsets?.dev ?? true,
		},
		async (input: ReviewState) => {
			try {
				const { origin } = server.ctx.custom ?? {};
				if (!origin) {
					throw new Error('Origin is required in addon context');
				}

				setReviewState(input);

				// Broadcast to all connected Storybook tabs. A warm tab navigates
				// to the review page; a cold start relies on the returned URL.
				server.ctx.custom?.options?.channel?.emit(APPLY_REVIEW_STATE_EVENT, input);

				const reviewUrl = `${origin}/?path=${REVIEW_PAGE_PATH}`;
				const collectionCount = input.collections.length;
				const storyCount = input.collections.reduce((n, c) => n + c.sampleStoryIds.length, 0);

				return {
					content: [
						{
							type: 'text' as const,
							text: `Review applied: ${collectionCount} collection${collectionCount === 1 ? '' : 's'}, ${storyCount} stor${storyCount === 1 ? 'y' : 'ies'}. Open it at: ${reviewUrl}`,
						},
					],
					structuredContent: { reviewUrl },
				};
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
}
