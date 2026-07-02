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

export const DISPLAY_REVIEW_TOOL_DESCRIPTION = `Publish a curated review to Storybook's review page for spot-checking **visual impact**. Each call replaces the single active review — call it again whenever the user iterates on the changes.

## When to call
- **Trigger 1 — visual change** (UI, CSS, theme, i18n): when the user should spot-check rendering. Skip non-visual refactors unless side-effects are plausible. Start from \`get-changed-stories\`; fall back to \`get-stories-by-component\` if change detection is unavailable. Include \`changedFiles\`.
- **Trigger 2 — browse request** ("show me the Badge component"): resolve via \`get-stories-by-component\` / \`list-all-documentation\`; you may consult other sources to interpret the ask, but IDs must still come from those tools. Pass \`changedFiles: []\` — no code changed.

## Hard rules
1. Every \`storyId\` MUST come from those tools. Reject IDs derived from file paths, story names, or memory.
2. Every story you CREATED in this change MUST appear in the review — including interaction/play-function stories. Showing the stories you modified is encouraged too. Curate by grouping, never by omission.
3. Prefer 2-5 collections; avoid one-story collections unless truly isolated.
4. Follow-up reviews: stabilize collection/story order to avoid disorientation from reshuffling.
5. Apply the field formatting rules from each schema property. Do not use em-dashes in review payload field values (title, rationale, description, etc.).
6. Do not instruct or tell the user what to do unless they explicitly ask for guidance.
7. "Collection" and "trigger" are internal terms for this tool's mechanics and mean nothing to users. Never use them in user-facing text unless the user used them first; say "group of stories" or just describe the contents in plain language.

## Curating (Trigger 1)
Trace the **visual cascade** up the **import graph** to **page-level UI surfaces** — one collection per layer (\`distance 0\` → direct importers → page context). Include **control stories** where the change is **not supposed to be visible**. **Theme tokens**, **shared styles**, and **layout primitives** need page-level coverage even from a single-file edit. **Localized changes:** affected component → **usage locations** → outer surfaces. **Larger features:** central page/module → lower-level pieces → outer **usage locations**.

## Curating (Trigger 2)
Exactly what the user asked for — **no more, no less**. Group logically or follow **story index hierarchy**.`;

/**
 * Canonical schema for the agent-pushed review payload.
 *
 * Server-side state caching and git-branch enrichment live on the
 * core server preset, not here — this tool just
 * validates the agent's input and forwards it over the channel.
 */
export const ReviewCollectionSchema = v.object({
	title: v.pipe(
		v.string(),
		v.description(
			'Title describing **what** this collection consists of, phrased the way a person would say it. Avoid typographic marks and CamelCase. Plain text, no markdown.',
		),
	),
	rationale: v.pipe(
		v.string(),
		v.description(
			'Rationale explaining **why** this collection is relevant to the user. Shown alongside the title. One or two sentences. Plain text, no markdown.',
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
			'Terse, human-readable title for the overall review. What is this review about? Avoid typographic marks and CamelCase. Plain text, no markdown.',
		),
	),
	description: v.pipe(
		v.string(),
		v.description(
			"Description of the review scope, including what's there, why it's relevant, and what to look for. Preferably one or two sentences. At most 2 paragraphs for reviews spanning multiple topics. Markdown formatting restricted to **bold**, _italic_, and `code` (backticks). Use emphasis for the key **what** and _why_, and backticks for literal source code references like component or token names.",
		),
	),
	collections: v.array(ReviewCollectionSchema),
	changedFiles: v.pipe(
		v.array(v.string()),
		v.description(
			'Paths of the files you changed, most central first. Pass an empty array `[]` only when no code changed (browse requests, Trigger 2).',
		),
	),
});

export type ReviewCollection = v.InferOutput<typeof ReviewCollectionSchema>;
export type ReviewState = v.InferOutput<typeof ReviewStateSchema>;

export const DisplayReviewOutput = v.object({
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

export function getDisplayReviewToolMetadata() {
	return {
		name: DISPLAY_REVIEW_TOOL_NAME,
		title: 'Display Storybook review',
		description: DISPLAY_REVIEW_TOOL_DESCRIPTION,
		schema: withFriendlyErrors(ReviewStateSchema),
		outputSchema: DisplayReviewOutput,
	};
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

export async function addDisplayReviewTool(
	server: McpServer<any, AddonContext>,
	enabled: Parameters<McpServer<any, AddonContext>['tool']>[0]['enabled'] = () =>
		server.ctx.custom?.toolsets?.dev ?? true,
) {
	server.tool(
		{
			...getDisplayReviewToolMetadata(),
			enabled,
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

				// Hand the payload off to core-server's review channel
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
						changedFileCount: input.changedFiles.length,
					});
				}

				return {
					content: [
						{
							type: 'text' as const,
							text: `Review applied: ${collectionCount} collection${collectionCount === 1 ? '' : 's'}, ${storyCount} stor${storyCount === 1 ? 'y' : 'ies'}. Storybook is already running at ${customContext.origin} — reuse it. Do NOT start another Storybook or change its port to view this review; the running instance already serves it.

Two things you must do now, both of them:
1. **Open ${reviewUrl} yourself in your preview browser.** If you have any browser-preview or navigate tool in this session (e.g. preview_eval or an equivalent), call it on this URL so the review opens in your preview window immediately. Don't merely print the link and stop — actually open it.
2. **Show the link to the user too.** End your final response with a dedicated review section as the very last thing: its own heading on a line by itself (e.g. \`## 👀 Review your changes\`), then a one-line explanation of what the review is, then on the next line the review page as a markdown link prefixed with a 👉 so it's easy to spot: \`👉 [Open the Storybook review page](${reviewUrl})\`. For the explanation, use something like: "The review shows the ${storyCount} stor${storyCount === 1 ? 'y' : 'ies'} most relevant for you to review right now. Because this is AI-curated, results may be inaccurate or incomplete." Put nothing after the link — not a trailing sentence the user has to hunt for. The user needs to see this link even after you've opened it yourself.`,
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
