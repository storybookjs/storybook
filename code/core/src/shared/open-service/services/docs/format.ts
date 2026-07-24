import type { DocsListResult, DocsShowResult, DocsShowStoryResult } from './map.ts';

function compact(parts: string[]): string {
  return parts
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatError(error: { name: string; message: string }): string[] {
  return [`Error: ${error.name}`, '', '```', error.message, '```'];
}

/** Formats the docs index as compact Markdown for humans and agents. */
export function formatDocsList(result: DocsListResult): string {
  const parts = ['# Components'];

  for (const component of result.components) {
    parts.push(
      `- ${component.name} (${component.id})${component.summary ? `: ${component.summary}` : ''}`
    );
    for (const storyId of component.storyIds ?? []) {
      parts.push(`  - ${storyId}`);
    }
  }

  if (result.docs.length > 0) {
    parts.push('', '# Docs');
    for (const doc of result.docs) {
      parts.push(`- ${doc.title ?? doc.name} (${doc.id})${doc.summary ? `: ${doc.summary}` : ''}`);
    }
  }

  return compact(parts);
}

/** Formats one component or standalone docs entry as Markdown. */
export function formatDocsShow(result: DocsShowResult): string {
  if (result.kind === 'not-found') {
    return `Component or docs entry not found: "${result.id}".`;
  }

  if (result.kind === 'docs') {
    return compact([
      `# ${result.title ?? result.name}`,
      ...(result.summary ? ['', result.summary] : []),
      ...(result.content ? ['', result.content] : []),
      ...(result.error ? ['', ...formatError(result.error)] : []),
    ]);
  }

  const parts = [
    `# ${result.name}`,
    ...(result.description ? ['', result.description] : result.summary ? ['', result.summary] : []),
    '',
    `ID: ${result.id}`,
  ];

  if (result.stories?.length) {
    parts.push('', '## Stories');
    for (const story of result.stories) {
      parts.push('', `### ${story.name}`);
      if (story.id) {
        parts.push('', `Story ID: ${story.id}`);
      }
      if (story.description ?? story.summary) {
        parts.push('', story.description ?? story.summary ?? '');
      }
      if (story.snippet) {
        parts.push('', '```', ...(result.import ? [result.import, ''] : []), story.snippet, '```');
      }
      if (story.error) {
        parts.push('', ...formatError(story.error));
      }
    }
  }

  if (result.docs) {
    const docsWithContent = Object.values(result.docs).filter((doc) => doc.content);
    if (docsWithContent.length > 0) {
      parts.push('', '## Docs');
      for (const doc of docsWithContent) {
        parts.push('', `### ${doc.title ?? doc.name}`, '', doc.content ?? '');
      }
    }
  }

  if (result.error) {
    parts.push('', ...formatError(result.error));
  }

  return compact(parts);
}

/** Formats one story lookup result as Markdown. */
export function formatDocsShowStory(result: DocsShowStoryResult): string {
  if (result.kind === 'component-not-found') {
    return `Component not found: "${result.componentId}".`;
  }
  if (result.kind === 'story-not-found') {
    const available = result.availableStoryNames.join(', ') || 'none';
    return `Story "${result.storyName}" not found for component "${result.componentId}". Available stories: ${available}.`;
  }

  const { component, story } = result;
  return compact([
    `# ${component.name} - ${story.name}`,
    ...(story.description ? ['', story.description] : story.summary ? ['', story.summary] : []),
    ...(story.snippet
      ? ['', '```', ...(component.import ? [component.import, ''] : []), story.snippet, '```']
      : []),
    ...(story.error ? ['', ...formatError(story.error)] : []),
  ]);
}
