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
import { APPLY_REVIEW_STATE_EVENT, REVIEW_PAGE_PATH } from '../constants.ts';
import { APPLY_REVIEW_STATE_TOOL_NAME } from './tool-names.ts';
import { currentGitBranch } from '../utils/git-branch.ts';

const ApplyReviewStateOutput = v.object({
	reviewUrl: v.pipe(
		v.string(),
		v.description(
			'URL of the Storybook review page. Always include this URL in your final user-facing response so the user can open it directly.',
		),
	),
});

/**
 * Resolve the Storybook manager root from the incoming MCP request.
 *
 * The MCP endpoint is mounted at `<storybook-root>/mcp`, so stripping the
 * trailing `/mcp` segment from the request path yields the root the
 * review page lives under. Unlike the context `origin` (always just
 * `http://localhost:<port>`), this preserves the real host and any path
 * prefix when Storybook is served behind a reverse proxy.
 */
function storybookRootFromRequest(request?: Request): string | undefined {
	if (!request?.url) return undefined;
	try {
		const url = new URL(request.url);
		const root = url.pathname.replace(/\/mcp\/?$/, '');
		return `${url.origin}${root}`;
	} catch {
		return undefined;
	}
}

/**
 * Build the URL of the Storybook review page. Prefers the incoming
 * request (carries the real host + path prefix); falls back to the
 * context `origin` when there is no request.
 */
export function buildReviewUrl(ctx: { origin?: string; request?: Request }): string {
	const root = storybookRootFromRequest(ctx.request) ?? ctx.origin;
	if (!root) {
		throw new Error('Cannot resolve the Storybook URL: no request or origin in addon context.');
	}
	return `${root.replace(/\/$/, '')}/?path=${REVIEW_PAGE_PATH}`;
}

export async function addApplyReviewStateTool(server: McpServer<any, AddonContext>) {
	server.tool(
		{
			name: APPLY_REVIEW_STATE_TOOL_NAME,
			title: 'Apply Storybook review state',
			description: `Push a curated review of the current change to Storybook's review page.

After you finish a UI code change, call this to help the user spot-check it. Provide:
- title: a PR-style title for the change — short and specific.
- description: a one-line summary of what changed and where to start reviewing.
- collections: titled groups of representative story IDs. Give each a concise, PR-dense title, a one-sentence rationale.
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
				const reviewUrl = buildReviewUrl(server.ctx.custom ?? {});

				// Resolve the target repo's current git branch server-side and
				// attach it — the agent's payload doesn't carry it, but the
				// review page shows it. Best-effort: omitted on a detached HEAD
				// or a non-git target.
				const branchName = await currentGitBranch(process.cwd());
				const state: StoredReviewState = branchName ? { ...input, branchName } : input;

				setReviewState(state);

				// Broadcast to all connected Storybook tabs. A warm tab navigates
				// to the review page; a cold start relies on the returned URL.
				server.ctx.custom?.options?.channel?.emit(APPLY_REVIEW_STATE_EVENT, state);

				const collectionCount = state.collections.length;
				const storyCount = state.collections.reduce((n, c) => n + c.storyIds.length, 0);

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
