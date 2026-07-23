import type {
  ChangedStoriesOutput,
  FindByComponentOutput,
  PreviewStoriesOutput,
} from './definition.ts';

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

/** Formats changed stories as compact Markdown for humans and agents. */
export function formatChangedStories({
  stories,
  counts,
  unreachableFiles,
}: ChangedStoriesOutput): string {
  const lines = [
    '# Changed stories',
    `New: ${counts.new}, modified: ${counts.modified}, affected: ${counts.affected}`,
  ];

  for (const story of stories) {
    lines.push(
      `- [${story.statusValue.replace('status-value:', '')}] ${story.title} - ${story.name}`
    );
  }

  if (unreachableFiles.length > 0) {
    lines.push('', '## Unreachable files', ...unreachableFiles.map((file) => `- ${file}`));
  }

  return lines.join('\n');
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
