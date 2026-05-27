import type { McpServer } from 'tmcp';
import * as v from 'valibot';
import type { AddonContext } from '../types.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import { PUSH_REVIEW_EVENT, REVIEW_PAGE_PATH } from '../constants.ts';
import { DISPLAY_REVIEW_TOOL_NAME } from './tool-names.ts';

/**
 * Canonical schema for the agent-pushed review payload.
 *
 * Server-side state caching and git-branch enrichment live on the
 * `@storybook/addon-review` server preset, not here — this tool just
 * validates the agent's input and forwards it over the channel.
 */
export const ReviewCollectionSchema = v.object({
	title: v.pipe(
		v.string(),
		v.description('Short, PR-dense title for this collection, e.g. "Direct Button importers".'),
	),
	rationale: v.pipe(
		v.string(),
		v.description('One sentence explaining why these stories are grouped together.'),
	),
	storyIds: v.pipe(
		v.array(v.string()),
		v.description(
			'Story IDs that represent this collection (e.g. "button--primary"). The page renders exactly these.',
		),
	),
	kind: v.pipe(
		v.optional(v.picklist(['atomic', 'consumer', 'transitive', 'catch-all'])),
		v.description(
			'Semantic role of this collection in the change cascade: "atomic" = the directly changed component, "consumer" = direct dependents, "transitive" = pages/containers further away, "catch-all" = everything else. Omit if unknown.',
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
	title: v.pipe(
		v.string(),
		v.description(
			'PR-style title for the change — short and specific, e.g. "Recolour the primary button".',
		),
	),
	description: v.pipe(
		v.string(),
		v.description('One-line summary of what changed and where to start reviewing.'),
	),
	collections: v.array(ReviewCollectionSchema),
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

export type ReviewCollection = v.InferOutput<typeof ReviewCollectionSchema>;
export type ReviewState = v.InferOutput<typeof ReviewStateSchema>;

const DisplayReviewOutput = v.object({
	reviewUrl: v.pipe(
		v.string(),
		v.description(
			'URL of the Storybook review page. Always include this URL in your final user-facing response so the user can open it directly.',
		),
	),
});

function storybookRootFromRequest(
	request: Request | undefined,
	trustedOrigin: string,
	endpoint: string,
): string | undefined {
	if (!request?.url) return undefined;
	try {
		const url = new URL(request.url);
		const normalizedEndpoint = endpoint.replace(/\/$/, '');
		const rootPath = url.pathname.endsWith(normalizedEndpoint)
			? url.pathname.slice(0, -normalizedEndpoint.length)
			: url.pathname.replace(/\/[^/]+\/?$/, '/');
		return `${trustedOrigin.replace(/\/$/, '')}${rootPath}`;
	} catch {
		return undefined;
	}
}

export function buildReviewUrl(ctx: {
	origin: string;
	request?: Request;
	endpoint?: string;
}): string {
	const trustedOrigin = ctx.origin;
	const root =
		ctx.request && trustedOrigin
			? storybookRootFromRequest(ctx.request, trustedOrigin, ctx.endpoint ?? '/mcp')
			: trustedOrigin;
	if (!root) {
		throw new Error('Cannot resolve the Storybook URL: missing trusted origin in addon context.');
	}
	return `${root.replace(/\/$/, '')}/?path=${REVIEW_PAGE_PATH}`;
}

export async function addDisplayReviewTool(server: McpServer<any, AddonContext>) {
	server.tool(
		{
			name: DISPLAY_REVIEW_TOOL_NAME,
			title: 'Display Storybook review',
			description: `Push a curated review of the current change to Storybook's review page.

After you finish a UI code change, call this to help the user spot-check it. Provide:
- title: a PR-style title for the change — short and specific.
- description: a one-line summary of what changed and where to start reviewing.
- collections: titled groups of representative story IDs. Give each a concise, PR-dense title, a one-sentence rationale, and — when you can tell — a kind ("atomic" for the directly changed component, "consumer" for direct dependents, "transitive" for pages/containers, "catch-all" otherwise).
- changedFiles: the files you edited (most central first).
- diffHunks: the actual diff of your change (you made it — include the hunks).
- storyMeta: optional per-story { depth, chain }.

The \`kind\` labels are for structured review grouping and UI behavior; do not repeat these labels verbatim in user-facing prose unless the user explicitly asks for them.

Always include the returned reviewUrl in your final user-facing response so the user can open it.`,
			schema: ReviewStateSchema,
			outputSchema: DisplayReviewOutput,
			enabled: () => server.ctx.custom?.toolsets?.dev ?? true,
		},
		async (input: ReviewState) => {
			try {
				const customContext = server.ctx.custom;
				if (!customContext?.origin) {
					throw new Error(
						'Cannot resolve the Storybook URL: missing trusted origin in addon context.',
					);
				}

				const reviewUrl = buildReviewUrl({
					origin: customContext.origin,
					request: customContext.request,
					endpoint: customContext.endpoint,
				});

				// Hand the payload off to @storybook/addon-review
				server.ctx.custom?.options?.channel?.emit(PUSH_REVIEW_EVENT, input);

				const collectionCount = input.collections.length;
				const storyCount = input.collections.reduce((n, c) => n + c.storyIds.length, 0);

				return {
					content: [
						{
							type: 'text' as const,
							text: `Review applied: ${collectionCount} collection${collectionCount === 1 ? '' : 's'}, ${storyCount} stor${storyCount === 1 ? 'y' : 'ies'}. Next step: if a browser-preview tool is available in this session (e.g. preview_eval or an equivalent navigate tool), open ${reviewUrl} in it so the user sees the review immediately. Otherwise include the URL in your final response.`,
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
