import type { ToolsetCtx } from '../../toolset-definition.ts';
import { getRef } from '../../toolset-names.ts';
import type {
  ChangedStoriesOutput,
  FindByComponentOutput,
  PreviewStoriesOutput,
} from './definition.ts';

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/** Formats preview URLs as compact Markdown for humans and agents. */
export function formatPreviewStories({ stories }: PreviewStoriesOutput): string {
  const lines = ['# Story previews'];

  for (const story of stories) {
    if ('error' in story) {
      lines.push(`- Error: ${story.error}`);
    } else {
      lines.push(`- ${story.title} - ${story.name}`, `  ${story.previewUrl}`);
    }
  }

  return lines.join('\n');
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
  return `\n\nThe following working-tree file(s) are modified but unreachable from any story (no static import path connects them — they are likely theme tokens, decorators, or other Storybook-preview-runtime files):\n${lines}\n\nFor these, grep the codebase for their exports (e.g. specific tokens or symbols) to find runtime consumers, then call \`${getRef(ctx)('stories.findByComponent')}\` with those consumer file paths.`;
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
  return `\n\nCoverage sanity check: the working tree also contains modified file(s) that aren't reachable from any story above (no static import path connects them — typically theme tokens, decorators, or other preview-runtime files):\n${lines}\n\nThe list above is real but may be stale w.r.t. these files — they're often left over from an earlier sub-change in the same diff. Before composing a review, grep the codebase for their exports and call \`${getRef(ctx)('stories.findByComponent')}\` with the runtime consumers' file paths. Do not assume the list above already covers them, and never invent story IDs to fill the gap.`;
}

export function formatChangedStories(
  { stories, counts, unreachableFiles }: ChangedStoriesOutput,
  ctx: ToolsetCtx,
  { reviewEnabled = false }: { reviewEnabled?: boolean } = {}
): string {
  if (ctx.consumer !== 'mcp') {
    const lines = [
      '# Changed stories',
      `New: ${counts.new}, modified: ${counts.modified}, affected: ${counts.affected}`,
      ...stories.map(
        (story) =>
          `- [${story.statusValue.replace('status-value:', '')}] ${story.title} - ${story.name}`
      ),
    ];
    if (unreachableFiles.length > 0) {
      lines.push('', '## Unreachable files', ...unreachableFiles.map((file) => `- ${file}`));
    }
    return lines.join('\n');
  }

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
    text += `\n\nNext: if the change is visually observable, publish the review now — call **${getRef(ctx)('review.create')}** curating these story IDs. That review link is how you finish; do not substitute individual preview URLs for it.`;
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

/** Formats component-to-story matches as compact Markdown for humans and agents. */
export function formatFindByComponent({ results }: FindByComponentOutput): string {
  const lines = ['# Stories by component'];

  for (const result of results) {
    lines.push(`## ${result.componentPath}`);
    if (result.pathNotFound) {
      lines.push('Path not found.');
      continue;
    }
    if (result.matches.length === 0) {
      lines.push('No matching stories.');
      continue;
    }
    for (const story of result.matches) {
      lines.push(
        `- ${story.title} - ${story.name} (${story.storyId}, distance ${story.distance})`,
        `  ${story.importPath}`
      );
    }
    if (result.clipped) {
      lines.push(
        `Clipped ${result.clipped.count} match${result.clipped.count === 1 ? '' : 'es'} at distance${result.clipped.distances.length === 1 ? '' : 's'} ${result.clipped.distances.join(', ')}.`
      );
    }
  }

  return lines.join('\n');
}
