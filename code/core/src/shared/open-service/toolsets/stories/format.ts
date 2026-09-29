import type { ToolsetCtx } from '../../toolset-definition.ts';
import { getToolName } from '../../toolset-names.ts';
import type {
  ChangedStoriesOutput,
  FindByComponentOutput,
  PreviewStoriesOutput,
} from './definition.ts';

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/**
 * Recovery nudge for the review exit ramp: agents that skip the review tool end visual work on
 * exactly this call, so the result itself has to contradict that while a step remains to recover in.
 */
function previewReviewNudge(ctx: ToolsetCtx): string {
  const reviewTool = getToolName(ctx)('review.create');
  return `These preview links are for iterating or sharing a specific story — they are not how visual work or a browse request ends. The ${reviewTool} tool is available in this session: if you are finishing visually observable work or showing a set of stories, publish the review with **${reviewTool}** and link that instead.`;
}

/**
 * Splits a preview result into the text blocks a consumer shows.
 *
 * MCP renders one block per URL; the CLI adapter joins the blocks into one document.
 */
export function formatPreviewStories(
  { stories }: PreviewStoriesOutput,
  ctx: ToolsetCtx,
  { reviewEnabled = false }: { reviewEnabled?: boolean } = {}
): string[] {
  const blocks = stories.map((story) => ('error' in story ? story.error : story.previewUrl));

  // An all-error result has nothing to curate, so the nudge only applies once a URL resolved.
  if (reviewEnabled && stories.some((story) => 'previewUrl' in story)) {
    blocks.push(previewReviewNudge(ctx));
  }

  return blocks;
}

const BANNER_INLINE_LIMIT = 3;

/**
 * Front-loaded coverage warning.
 *
 * Duplicates {@link formatPartialCoverageHint}'s information on purpose: with a long story list the
 * tail hint can land past a host's tool-output truncation cap, and the leading banner is the part
 * that survives.
 */
function formatPartialCoverageBanner(unreachable: string[]): string {
  if (unreachable.length === 0) {
    return '';
  }
  const fileList =
    unreachable.length <= BANNER_INLINE_LIMIT
      ? unreachable.join(', ')
      : `${unreachable.slice(0, BANNER_INLINE_LIMIT).join(', ')}, +${unreachable.length - BANNER_INLINE_LIMIT} more`;
  return `⚠ Coverage gap: ${unreachable.length} modified ${pluralize(unreachable.length, 'file')} unreachable from any story (${fileList}) — full sanity-check note at end of this response.\n\n`;
}

/** Hint appended to an empty changed-stories response. */
function formatUnreachableHint(unreachable: string[], ctx: ToolsetCtx): string {
  if (unreachable.length === 0) {
    return '';
  }
  const lines = unreachable.map((file) => `- ${file}`).join('\n');
  return `\n\nThe following working-tree file(s) are modified but unreachable from any story (no static import path connects them — they are likely theme tokens, decorators, or other Storybook-preview-runtime files):\n${lines}\n\nFor these, grep the codebase for their exports (e.g. specific tokens or symbols) to find runtime consumers, then call \`${getToolName(ctx)('stories.findByComponent')}\` with those consumer file paths.`;
}

/**
 * Hint for the non-empty case: the changed list is real but may be stale with respect to files the
 * diff also touched that no story reaches, so the agent has to check coverage rather than trust it.
 */
function formatPartialCoverageHint(unreachable: string[], ctx: ToolsetCtx): string {
  if (unreachable.length === 0) {
    return '';
  }
  const lines = unreachable.map((file) => `- ${file}`).join('\n');
  return `\n\nCoverage sanity check: the working tree also contains modified file(s) that aren't reachable from any story above (no static import path connects them — typically theme tokens, decorators, or other preview-runtime files):\n${lines}\n\nThe list above is real but may be stale w.r.t. these files — they're often left over from an earlier sub-change in the same diff. Before composing a review, grep the codebase for their exports and call \`${getToolName(ctx)('stories.findByComponent')}\` with the runtime consumers' file paths. Do not assume the list above already covers them, and never invent story IDs to fill the gap.`;
}

export function formatChangedStories(
  { stories, counts, unreachableFiles }: ChangedStoriesOutput,
  ctx: ToolsetCtx,
  { reviewEnabled = false }: { reviewEnabled?: boolean } = {}
): string {
  if (stories.length === 0) {
    return `No new, modified, or related stories detected.${formatUnreachableHint(unreachableFiles, ctx)}`;
  }

  const buckets = {
    new: stories.filter((story) => story.statusValue === 'status-value:new'),
    modified: stories.filter((story) => story.statusValue === 'status-value:modified'),
    affected: stories.filter((story) => story.statusValue === 'status-value:affected'),
  };

  let text = `${formatPartialCoverageBanner(unreachableFiles)}Detected ${stories.length} changed stor${pluralize(stories.length, 'y', 'ies')} (${counts.new} new, ${counts.modified} modified, ${counts.affected} related).`;

  // Front-loaded like the banner: host-side output caps can cut the tail of a long story list, and
  // this next step is what keeps agents from ending visual work at preview URLs.
  if (reviewEnabled) {
    text += `\n\nNext: if the change is visually observable, publish the review now — call **${getToolName(ctx)('review.create')}** curating these story IDs. That review link is how you finish; do not substitute individual preview URLs for it.`;
  }

  const serializeStory = ({
    storyId,
    title,
    name,
    importPath,
  }: ChangedStoriesOutput['stories'][number]) =>
    `- \`${storyId}\`: ${title} / ${name} (\`${importPath}\`)`;

  if (buckets.new.length > 0) {
    text += `\n\nNew stories:\n${buckets.new.map(serializeStory).join('\n')}`;
  }
  if (buckets.modified.length > 0) {
    text += `\n\nModified stories:\n${buckets.modified.map(serializeStory).join('\n')}`;
  }
  if (buckets.affected.length > 0) {
    text += `\n\nRelated stories:\n${buckets.affected.map(serializeStory).join('\n')}`;
  }

  return text + formatPartialCoverageHint(unreachableFiles, ctx);
}

function formatClippedTail(
  clipped: { count: number; distances: number[] },
  maxDistance: number
): string {
  const { distances } = clipped;
  const rangeText =
    distances.length === 1
      ? `distance ${distances[0]}`
      : `distances ${distances[0]}..${distances[distances.length - 1]}`;
  return `+${clipped.count} more ${pluralize(clipped.count, 'story', 'stories')} at ${rangeText} hidden by \`maxDistance: ${maxDistance}\``;
}

/** Renders one component's matches, bucketed by import-graph distance. */
export function serializeComponentSection(
  { componentPath, matches, clipped, pathNotFound }: FindByComponentOutput['results'][number],
  maxDistance: number
): string {
  if (pathNotFound) {
    return `${componentPath}: path does not exist on disk — re-check the path you sent.`;
  }

  // "No stories at all" and "the cap filtered everything out" need different follow-ups.
  if (matches.length === 0) {
    if (clipped && clipped.count > 0) {
      return `${componentPath}: no stories within \`maxDistance: ${maxDistance}\` — ${formatClippedTail(clipped, maxDistance)}.`;
    }
    return `${componentPath}: no stories found`;
  }

  const byDistance = new Map<number, FindByComponentOutput['results'][number]['matches']>();
  for (const match of matches) {
    const bucket = byDistance.get(match.distance) ?? [];
    bucket.push(match);
    byDistance.set(match.distance, bucket);
  }

  const distances = [...byDistance.keys()].sort((a, b) => a - b);
  const componentCount = new Set(matches.map((match) => match.title)).size;
  const bucketSummary = distances.map((d) => `d${d}=${byDistance.get(d)!.length}`).join(', ');
  const lines = [
    `${componentPath}:`,
    `→ ${matches.length} ${pluralize(matches.length, 'story', 'stories')} across ${componentCount} ${pluralize(componentCount, 'component')}, distances ${distances[0]}..${distances[distances.length - 1]} (${bucketSummary})`,
  ];

  for (const distance of distances) {
    lines.push(`distance ${distance}:`);
    for (const match of byDistance.get(distance)!) {
      lines.push(
        `  - \`${match.storyId}\`: ${match.title} / ${match.name} (\`${match.importPath}\`)`
      );
    }
  }

  if (clipped && clipped.count > 0) {
    lines.push(`  (${formatClippedTail(clipped, maxDistance)}.)`);
  }

  return lines.join('\n');
}

export function formatFindByComponent({ results, maxDistance }: FindByComponentOutput): string {
  return results.length === 0
    ? 'No component paths provided.'
    : results.map((result) => serializeComponentSection(result, maxDistance)).join('\n\n');
}
