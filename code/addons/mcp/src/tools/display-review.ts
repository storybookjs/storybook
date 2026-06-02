import type { McpServer } from 'tmcp';
import * as v from 'valibot';
import type { AddonContext } from '../types.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import { getStoryIndex } from '../utils/get-story-index.ts';
import type { Options } from 'storybook/internal/types';
import { withFriendlyErrors } from '../utils/format-validation-issues.ts';
import { DEFAULT_MCP_ENDPOINT, PUSH_REVIEW_EVENT, REVIEW_PAGE_PATH } from '../constants.ts';
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
		const normalizedPathname = url.pathname.replace(/\/$/, '');
		const rootPath = normalizedPathname.endsWith(normalizedEndpoint)
			? normalizedPathname.slice(0, -normalizedEndpoint.length)
			: normalizedPathname.replace(/\/[^/]+$/, '');
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
	if (!trustedOrigin) {
		throw new Error('Cannot resolve the Storybook URL: missing trusted origin in addon context.');
	}
	const root = ctx.request
		? (storybookRootFromRequest(ctx.request, trustedOrigin, ctx.endpoint ?? DEFAULT_MCP_ENDPOINT) ??
			trustedOrigin)
		: trustedOrigin;
	return `${root.replace(/\/$/, '')}/?path=${REVIEW_PAGE_PATH}`;
}

/**
 * Returns the storyIds the agent passed that don't resolve against the live
 * Storybook index. Order-preserving and deduplicated so the error message
 * lists each fabricated ID once, in the order the agent provided them.
 */
async function collectUnknownStoryIds(
	collections: ReadonlyArray<{ readonly storyIds: ReadonlyArray<string> }>,
	options: Options,
): Promise<string[]> {
	const requested = new Set<string>();
	const inOrder: string[] = [];
	for (const collection of collections) {
		for (const id of collection.storyIds) {
			if (!requested.has(id)) {
				requested.add(id);
				inOrder.push(id);
			}
		}
	}
	if (inOrder.length === 0) return [];

	const index = await getStoryIndex(options);
	return inOrder.filter((id) => !index.entries[id]);
}

function formatUnknownStoryIdsError(unknownIds: string[]): string {
	const list = unknownIds.map((id) => `- \`${id}\``).join('\n');
	const plural = unknownIds.length === 1 ? 'ID is' : 'IDs are';
	return `Refusing to publish review: ${unknownIds.length} story ${plural} not in the live Storybook index:\n${list}\n\nThis usually means the IDs were inferred from file paths or naming conventions rather than returned by a tool. Resolve real IDs by calling \`get-stories-by-component\` (for components you've edited or want covered) or \`list-all-documentation\` (to browse the index), then retry \`display-review\` with the verified IDs. Do not invent IDs to satisfy this check.`;
}

export async function addDisplayReviewTool(server: McpServer<any, AddonContext>) {
	server.tool(
		{
			name: DISPLAY_REVIEW_TOOL_NAME,
			title: 'Display Storybook review',
			description: `Push a curated review of the current change to Storybook's review page.

**Every storyId you pass here must have come from a tool result in this session** — \`get-changed-stories\`, \`get-stories-by-component\`, or \`list-all-documentation\`. IDs derived from file paths, story-file naming conventions, feature names, or memory will not resolve. The tool validates every ID against the live Storybook index and rejects the whole review if any are unknown, so guessing is a hard failure, not a soft one. If you don't have a verified ID for a story you want to include, call \`get-stories-by-component\` first.

After you finish a UI code change, call this to help the user spot-check it.

Before composing collections, answer two questions:
- *Where is this change rendered?* Trace upward from the edited file through the import graph until you hit page-level or top-level story files.
- *What would a reviewer want to spot-check in real context?* Include at least one story per layer of that chain.

Provide:
- title: a PR-style title for the change — short and specific.
- description: a one-line summary of what changed and where to start reviewing.
- collections: titled groups of stories covering the **visual cascade** of the change — not just where the code is read, but everywhere a reviewer will see it. For any non-trivial UI change, include the changed component itself, the components that directly import it, and the pages/containers that render them further up the tree. A single-collection review is a smell: only do it if the component is genuinely standalone (e.g. has no parents in the story graph). Theme tokens, shared styles, and layout primitives almost always need page-level coverage even when only one file imports them. Give each collection a concise, PR-dense title and a one-sentence rationale. Titles should describe *what stories the reviewer is looking at* (e.g. "Button — all variants", "Checkout pages"), not the collection's role in the cascade.
- changedFiles: the files you edited (most central first).

Anti-pattern: editing a theme token that only one component reads, then publishing a review with just that one component's story. The token change is visible on every page that renders the component — include those pages.

Always include the returned reviewUrl in your final user-facing response so the user can open it. This tool maintains a single active review state; each call replaces the previously published review.`,
			schema: withFriendlyErrors(ReviewStateSchema),
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
				if (!customContext.options) {
					throw new Error('Storybook options are required in addon context.');
				}

				// Validate every storyId against the live index before publishing.
				// Without this gate, fabricated IDs (e.g. derived from filenames or
				// naming conventions) make it into the review unchallenged — the
				// agent gets a reviewUrl back, assumes success, and the user opens
				// a broken page. Hard-failing here forces the agent to resolve
				// real IDs via get-stories-by-component before retrying.
				const unknownIds = await collectUnknownStoryIds(input.collections, customContext.options);
				if (unknownIds.length > 0) {
					throw new Error(formatUnknownStoryIdsError(unknownIds));
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
