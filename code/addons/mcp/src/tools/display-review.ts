import type { McpServer } from 'tmcp';
import * as v from 'valibot';
import type { AddonContext } from '../types.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import {
	ReviewStateSchema,
	setReviewState,
	type ReviewState,
	type StoredReviewState,
} from '../review-state-store.ts';
import { DISPLAY_REVIEW_EVENT, REVIEW_PAGE_PATH } from '../constants.ts';
import { DISPLAY_REVIEW_TOOL_NAME } from './tool-names.ts';
import { currentGitBranch } from '../utils/git-branch.ts';

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

				// Resolve the target repo's current git branch server-side and
				// attach it — the agent's payload doesn't carry it, but the
				// review page shows it. Best-effort: omitted on a detached HEAD
				// or a non-git target.
				const branchName = await currentGitBranch(process.cwd());
				const state: StoredReviewState = branchName ? { ...input, branchName } : input;

				setReviewState(state);

				// Broadcast to all connected Storybook tabs. A warm tab navigates
				// to the review page; a cold start relies on the returned URL.
				server.ctx.custom?.options?.channel?.emit(DISPLAY_REVIEW_EVENT, state);

				const collectionCount = state.collections.length;
				const storyCount = state.collections.reduce((n, c) => n + c.storyIds.length, 0);

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
