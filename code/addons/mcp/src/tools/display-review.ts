import type { McpServer } from 'tmcp';
import * as v from 'valibot';
import type { AddonContext } from '../types.ts';
import { collectTelemetry } from '../telemetry.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import { getStoryIndex } from '../utils/get-story-index.ts';
import type { Options } from 'storybook/internal/types';
import { withFriendlyErrors } from '../utils/format-validation-issues.ts';
import { DEFAULT_MCP_ENDPOINT, PUSH_REVIEW_EVENT, REVIEW_PAGE_PATH } from '../constants.ts';
import { DISPLAY_REVIEW_TOOL_NAME } from './tool-names.ts';

const DISPLAY_REVIEW_TOOL_DESCRIPTION = `Create a curated set of stories to display on Storybook's review page. Use this to spot-check the visual impact of a code change, or to show the user specific components or stories when they ask for them. Call this automatically after changing any code that is expected to impact frontend application code or UI components.

**Every storyId you use MUST come from one of these tools:** — \`get-changed-stories\`, \`get-stories-by-component\`, or \`list-all-documentation\`. Reject any storyIds derived from file paths, story names, or memory. If you don't have a verified storyId for a story you want to include, call \`get-stories-by-component\` to resolve it first.

## Triggers

1. **After a frontend, UI component, CSS, theme or localization code change**: Automatically invoke this tool to help the user spot-check for visual changes. Use \`get-changed-stories\` to get the list of stories that changed, and curate from there, or fall back to \`get-stories-by-component\` if change detection is unavailable.
2. **When the user requests to see stories or components** (e.g. "show me all badge components", "what button variants do we have", "display the checkout stories"): Find a relevant set of stories matching the request using \`get-stories-by-component\` and/or \`list-all-documentation\`. Skip \`get-changed-stories\` because file changes are irrelevant in this case.

## Curating collections

A review mainly consists of a list of collections, each containing at least one story (preferably more than one). It is your job to select/curate relevant stories, and group them into collections. Depending on the trigger, you will use a different process to curate collections.

When reviewing code changes (**Trigger 1**):
- Answer: *What components, pages or other UI surfaces are affected by this code?* by tracing upward from the edited files through the import graph until you hit page-level or top-level story files.
- Answer: *What would a developer want to spot-check in real context?* by considering the visual impact of the changes, including places where changes are explicitly not supposed to be visible.
- Include at least one story per layer of the import chain. In case of a localized change or refactor, start with the most immediately affected components/stories, followed by their usage locations, and so on. In case of a larger feature, start with the most central components/stories (page / container / module), followed by specific lower-level components, and finish with the outermost high-level usage locations (if not yet covered).

## Output

- title: a PR-style title for the change — short and specific.
- description: a one-line summary of what changed and where to start reviewing.
- collections: titled groups of stories covering the **visual cascade** of the change — not just where the code is read, but everywhere a reviewer will see it. Guidelines:
    - For any non-trivial UI change, include the changed component itself, the components that directly import it, and the pages/containers that render them further up the tree.
    - A single-collection review is a smell: only do it if the component is genuinely standalone (e.g. has no parents in the story graph).
    - Theme tokens, shared styles, and layout primitives almost always need page-level coverage even when only one file imports them.
    - Give each collection a concise title and a one-sentence rationale. The title describes **what** this collection consists of, written the way a human would say it (e.g. "All the Button variants", "The checkout pages") — never in story-title format like "Button — all variants" or "UI/Button/Primary", which reads as a Storybook story title. The rationale explains **why** this collection is relevant to the change (e.g. "The pages where \`Button\` appears in real context"). Rationales are markdown restricted to **bold**, *italic*, and \`code\` (backticks) — use emphasis for the key concept and backticks for code identifiers; no links, headings, or lists.
    - Never instruct the reviewer, and avoid imperatives like "verify", "check", "ensure", "confirm" — describe what's on screen and why it matters, not tasks to perform.
    - When iterating on a review, keep collections and stories that also appeared in a previous review in the same order, so the reviewer isn't disoriented by reshuffling.
- changedFiles: the files you edited (most central first); omit when the user just wants to see stories rather than review a change.

Anti-pattern: editing a theme token that only one component reads, then publishing a review with just that one component's story. The token change is visible on every page that renders the component — include those pages.

Always include the returned reviewUrl in your final user-facing response so the user can open it. This tool maintains a single active review state; each call replaces the previously published review.`;

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
		v.description(
			'Short, human-readable title for this collection — phrased the way a person would say it, e.g. "Components that use the Button" or "The checkout pages". Avoid story-title formats like "Button — all variants" or "UI/Button/Primary"; it must not be mistaken for a Storybook story title. Plain text, no markdown.',
		),
	),
	rationale: v.pipe(
		v.string(),
		v.description(
			'One sentence explaining why this collection is relevant to the change — what it shows and why a reviewer would look here. Describe the content on screen, not tasks for the reviewer. No imperatives ("verify", "check", "make sure", "ensure", "confirm"): say what is shown and why it matters (e.g. "The checkout pages where the **Button** appears in real context"), not what to do (e.g. "Verify it still renders correctly"). Write in markdown, restricted to **bold**, *italic*, and `code` (backticks) — no links, headings, or lists. Use bold/italic to highlight the key concept and backticks for code identifiers like component or token names (e.g. "The checkout pages where `Button` appears in real context").',
		),
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
			description: DISPLAY_REVIEW_TOOL_DESCRIPTION,
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

				if (!customContext.disableTelemetry) {
					await collectTelemetry({
						event: 'tool:displayReview',
						server,
						toolset: 'dev',
						collectionCount,
						storyCount,
						changedFileCount: input.changedFiles?.length ?? 0,
					});
				}

				return {
					content: [
						{
							type: 'text' as const,
							text: `Review applied: ${collectionCount} collection${collectionCount === 1 ? '' : 's'}, ${storyCount} stor${storyCount === 1 ? 'y' : 'ies'}. Storybook is already running at ${customContext.origin} — reuse it. Do NOT start another Storybook or change its port to view this review; the running instance already serves it.

Two things you must do now, both of them:
1. **Open ${reviewUrl} yourself in your preview browser.** If you have any browser-preview or navigate tool in this session (e.g. preview_eval or an equivalent), call it on this URL so the review opens in your preview window immediately. Don't merely print the link and stop — actually open it.
2. **Show the link to the user too.** End your final response with a dedicated review section as the very last thing: its own heading on a line by itself (e.g. \`## 👀 Review your changes\`), then a one-line explanation of what the review is, then the review page as a markdown link \`[Open the Storybook review page](${reviewUrl})\`. For the explanation, use something like: "The review shows the ${storyCount} stor${storyCount === 1 ? 'y' : 'ies'} most relevant for you to review right now. Because this is AI-curated, results may be inaccurate or incomplete." Put nothing after the link — not a trailing sentence the user has to hunt for. The user needs to see this link even after you've opened it yourself.`,
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
