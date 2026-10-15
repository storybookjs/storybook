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

export function previewInstructions(
  stories: PreviewStoriesOutput['stories'],
  ctx: ToolsetCtx
): string | undefined {
  // An all-error result has nothing to curate or open, so the nudge only applies once a URL resolved.
  if (!stories.some((story) => 'previewUrl' in story)) {
    return undefined;
  }
  return previewReviewNudge(ctx);
}

/**
 * Splits a preview result into the text blocks a consumer shows.
 *
 * MCP renders one block per URL; the CLI adapter joins the blocks into one document.
 */
export function formatPreviewStories({ stories, instructions }: PreviewStoriesOutput): string[] {
  const blocks = stories.map((story) => ('error' in story ? story.error : story.previewUrl));
  return instructions ? [...blocks, instructions] : blocks;
}

function formatQuotedList(files: string[]): string {
  return files.map((file) => `\`${file}\``).join(', ');
}

function formatChangedFilesOutsideStories(
  {
    unreachableFiles,
    unreachableFilesTruncated,
    pendingFiles,
    unindexedStoryFiles,
    changedConfigFiles,
  }: ChangedStoriesOutput,
  ctx: ToolsetCtx
): string {
  const notes: string[] = [];
  if (pendingFiles.length > 0) {
    notes.push(
      `Change detection has not processed these changed files yet, although stories render them: ${formatQuotedList(pendingFiles)}. Pass them to \`${getToolName(ctx)('stories.findByComponent')}\` for their story IDs.`
    );
  }
  if (unindexedStoryFiles.length > 0) {
    notes.push(
      `Story files that are not in the story index yet: ${formatQuotedList(unindexedStoryFiles)}. A file written a moment ago takes a moment to index: pass it to \`${getToolName(ctx)('stories.findByComponent')}\` for its story IDs. If that finds none, the file is outside the \`stories\` globs of the main config.`
    );
  }
  if (changedConfigFiles.length > 0) {
    notes.push(
      `Changed files in the Storybook config directory, which can affect every story: ${formatQuotedList(changedConfigFiles)}.`
    );
  }
  if (unreachableFiles.length > 0) {
    const capped = unreachableFilesTruncated ? ` (first ${unreachableFiles.length} files)` : '';
    notes.push(
      `Coverage sanity check${capped}: the working tree also contains modified file(s) that aren't reachable from any story (no static import path connects them), so this result can miss stories they affect: ${formatQuotedList(unreachableFiles)}. A component: write its stories, or tell the user. A file used without an import, such as a CSS-variable token: pass the components that use it to \`${getToolName(ctx)('stories.findByComponent')}\`. Anything else, such as an app entry file: leave it out of the review. Never invent story IDs to fill the gap.`
    );
  }
  return notes.map((note) => `\n\n${note}`).join('');
}

export function formatChangedStories(data: ChangedStoriesOutput, ctx: ToolsetCtx): string {
  const { stories, counts } = data;
  if (stories.length === 0) {
    return `No new, modified, or related stories detected.${formatChangedFilesOutsideStories(data, ctx)}`;
  }

  const buckets = {
    new: stories.filter((story) => story.statusValue === 'status-value:new'),
    modified: stories.filter((story) => story.statusValue === 'status-value:modified'),
    affected: stories.filter((story) => story.statusValue === 'status-value:affected'),
  };

  let text = `Detected ${stories.length} changed stor${pluralize(stories.length, 'y', 'ies')} (${counts.new} new, ${counts.modified} modified, ${counts.affected} related).`;

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

  text += formatChangedFilesOutsideStories(data, ctx);

  const gapStories =
    data.unreachableFiles.length > 0 ||
    data.unindexedStoryFiles.length > 0 ||
    data.pendingFiles.length > 0
      ? ' and any you found for the files listed above'
      : '';
  // Last, so output read through `tail` still ends on this step.
  text += `\n\nNext: if the change is visually observable, publish the review now — call **${getToolName(ctx)('review.create')}** curating these story IDs${gapStories}. That review link is how you finish; do not substitute individual preview URLs for it.`;

  return text;
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
