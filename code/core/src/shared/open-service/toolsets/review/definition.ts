import * as v from 'valibot';

import {
  OpenServiceMissingOriginError,
  describeUnknownStoryIds,
  OpenServiceUnknownStoryIdsError,
} from '../../../../server-errors.ts';
import {
  defineToolset,
  reportToolsetTelemetry,
  type ToolsetCtx,
  type ToolsetOutcome,
} from '../../toolset-definition.ts';
import { getToolName } from '../../toolset-names.ts';
import type { ReviewService } from '../../services/review/definition.ts';

/** Storybook manager route the review page is registered at. */
const REVIEW_PAGE_PATH = '/review/';

const reviewCollectionSchema = v.object({
  title: v.pipe(
    v.string(),
    v.description(
      'Title describing **what** this collection consists of, phrased the way a person would say it. Avoid typographic marks and CamelCase. Plain text, no markdown.'
    )
  ),
  rationale: v.pipe(
    v.string(),
    v.description(
      'Rationale explaining **why** this collection is relevant to the user. Shown alongside the title. One or two sentences. Plain text, no markdown.'
    )
  ),
  storyIds: v.pipe(
    v.array(v.string()),
    v.description(
      'Story IDs that represent this collection (e.g. "button--primary"). The page renders exactly these.'
    )
  ),
});

const reviewCreateInputSchema = v.object({
  title: v.pipe(
    v.string(),
    v.description(
      'Terse, human-readable title for the overall review. What is this review about? Avoid typographic marks and CamelCase. Plain text, no markdown.'
    )
  ),
  description: v.pipe(
    v.string(),
    v.description(
      "Description of the review scope, including what's there, why it's relevant, and what to look for. Preferably one or two sentences. At most 2 paragraphs for reviews spanning multiple topics. Markdown formatting restricted to **bold**, _italic_, and `code` (backticks). Use emphasis for the key **what** and _why_, and backticks for literal source code references like component or token names."
    )
  ),
  collections: v.pipe(
    v.array(reviewCollectionSchema),
    v.description(
      'Groups of stories to show in the review, most relevant first. Prefer 2-5 groups.'
    )
  ),
  changedFiles: v.pipe(
    v.array(v.string()),
    v.description(
      'Paths of the files you changed, most central first. Pass an empty array `[]` only when no code changed (browse requests, Trigger 2).'
    )
  ),
});

type ReviewCreateInput = v.InferOutput<typeof reviewCreateInputSchema>;

const reviewCreateOutputSchema = v.object({
  reviewUrl: v.pipe(
    v.string(),
    v.description(
      'URL of the Storybook review page. Always include this URL in your final user-facing response so the user can open it directly.'
    )
  ),
});

export type ReviewCreateOutput = {
  reviewUrl: string;
  collectionCount: number;
  storyCount: number;
};

function describeCreate(ctx: ToolsetCtx): string {
  const ref = getToolName(ctx);
  return `Publish a curated review to Storybook's review page for spot-checking **visual impact**. Each call replaces the single active review — call it again whenever the user iterates on the changes.

## When to call
- **Trigger 1 — visual change** (components, stories, CSS, themes, colors, design tokens, i18n — anything that changes how the UI looks): when the user should spot-check rendering. A shared file (token, style, util) has no stories of its own — review its consumers' stories. Skip non-visual refactors unless side-effects are plausible. Start from \`${ref('stories.changed')}\`; fall back to \`${ref('stories.findByComponent')}\` if change detection is unavailable. Include \`changedFiles\`.
- **Trigger 2 — browse request** ("show me the Badge component"): resolve via \`${ref('stories.findByComponent')}\` / \`${ref('docs.list')}\`; you may consult other sources to interpret the ask, but IDs must still come from those tools. Pass \`changedFiles: []\` — no code changed.

## Hard rules
1. Every \`storyId\` MUST come from those tools. Reject IDs derived from file paths, story names, or memory. Unknown IDs cause a runtime error; obtain real IDs via \`${ref('stories.findByComponent')}\` or \`${ref('docs.list')}\`, then retry.
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
}

/**
 * Recovery coaching for fabricated story ids.
 *
 * The service reports which ids missed the index; the actionable part — which tools resolve real
 * ids on this surface — is consumer-specific, so it is composed here rather than in the service.
 */
function formatUnknownStoryIdsError(unknownIds: string[], ctx: ToolsetCtx): string {
  const ref = getToolName(ctx);
  const list = unknownIds.map((id) => `- \`${id}\``).join('\n');
  return `${describeUnknownStoryIds(unknownIds)}\n${list}\n\nThis usually means the IDs were inferred from file paths or naming conventions rather than returned by a tool. Resolve real IDs by calling \`${ref('stories.findByComponent')}\` (for components you've edited or want covered) or \`${ref('docs.list')}\` (to browse the index), then retry \`${ref('review.create')}\` with the verified IDs. Do not invent IDs to satisfy this check.`;
}

/** Pure renderer for a published review. */
function formatReviewApplied(
  { reviewUrl, collectionCount, storyCount }: ReviewCreateOutput,
  ctx: ToolsetCtx
): string {
  const storyNoun = storyCount === 1 ? 'y' : 'ies';
  const summary = `Review applied: ${collectionCount} collection${collectionCount === 1 ? '' : 's'}, ${storyCount} stor${storyNoun}.`;

  // Agents were observed ending visual work at the tool result, so the result itself has to
  // carry both follow-ups: open the page, and surface the link in the final response.
  // The running instance is named by the same UI root the review link is built from — for a
  // sub-path-hosted Storybook the bare origin is not an address the agent can reach.
  return `${summary} Storybook is already running at ${ctx.origin} — reuse it. Do NOT start another Storybook or change its port to view this review; the running instance already serves it.

Two things you must do now, both of them:
1. **Open ${reviewUrl} yourself in your preview browser.** If you have any browser-preview or navigate tool in this session (e.g. preview_eval or an equivalent), call it on this URL so the review opens in your preview window immediately. Don't merely print the link and stop — actually open it.
2. **Show the link to the user too.** End your final response with a dedicated review section as the very last thing: its own heading on a line by itself (e.g. \`## 👀 Review your changes\`), then a one-line explanation of what the review is, then on the next line the review page as a markdown link prefixed with a 👉 so it's easy to spot: \`👉 [Open the Storybook review page](${reviewUrl})\`. For the explanation, use something like: "The review shows the ${storyCount} stor${storyNoun} most relevant for you to review right now. Because this is AI-curated, results may be inaccurate or incomplete." Put nothing after the link — not a trailing sentence the user has to hunt for. The user needs to see this link even after you've opened it yourself.`;
}

export const reviewToolset = defineToolset({
  id: 'review',
  description: 'Create a curated Storybook review.',
  methods: {
    create: {
      input: reviewCreateInputSchema,
      output: reviewCreateOutputSchema,
      title: 'Create Storybook review',
      // Reviews publish into the running Storybook's review service and link into its UI.
      requiresDevServer: true,
      description: describeCreate,
      handler: async (
        review: ReviewCreateInput,
        ctx
      ): Promise<ToolsetOutcome<ReviewCreateOutput, never>> => {
        if (!ctx.origin) {
          throw new OpenServiceMissingOriginError({
            toolsetId: 'review',
            methodName: 'create',
          });
        }

        try {
          await ctx
            .getService<ReviewService>('core/review', { internal: true })
            .commands.setReview(review);
        } catch (error) {
          if (error instanceof OpenServiceUnknownStoryIdsError) {
            throw new Error(formatUnknownStoryIdsError(error.data.unknownIds, ctx));
          }
          throw error;
        }

        const collectionCount = review.collections.length;
        const storyCount = review.collections.reduce(
          (total, collection) => total + collection.storyIds.length,
          0
        );

        await reportToolsetTelemetry(ctx, 'tool:displayReview', {
          toolset: 'dev',
          collectionCount,
          storyCount,
          changedFileCount: review.changedFiles.length,
        });

        const data: ReviewCreateOutput = {
          reviewUrl: `${ctx.origin.replace(/\/$/, '')}/?path=${REVIEW_PAGE_PATH}`,
          collectionCount,
          storyCount,
        };

        return { ok: true, data, markdown: formatReviewApplied(data, ctx) };
      },
    },
  },
});

export type ReviewToolset = typeof reviewToolset;
