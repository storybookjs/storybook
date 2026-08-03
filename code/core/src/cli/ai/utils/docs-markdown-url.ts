import type { ProjectInfo } from '../types.ts';

/**
 * Builds a markdown-format docs URL with renderer and language query parameters.
 * Appending .md to any Storybook docs URL returns clean markdown with code examples.
 */
export function getDocsMarkdownUrl(
  path: string,
  projectInfo?: Pick<ProjectInfo, 'majorVersion' | 'renderer' | 'language'>
): string {
  const { majorVersion, renderer = 'react', language = 'ts' } = projectInfo ?? {};
  const versionSegment = majorVersion ? `/${majorVersion}` : '';
  const params = new URLSearchParams();
  if (renderer) {
    params.set('renderer', renderer);
  }
  params.set('language', language);
  const query = params.toString();
  return `https://storybook.js.org/docs${versionSegment}/${path}.md${query ? `?${query}` : ''}`;
}
