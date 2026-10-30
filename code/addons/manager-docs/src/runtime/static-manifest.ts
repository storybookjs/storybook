import type { ChannelLike } from 'storybook/internal/channels';

import { STATIC_MDX_MANIFEST_FILE } from '../constants.ts';
import { ManagerDocsError, ManagerDocsParseError } from '../errors.ts';
import { parseManagerDocs } from '../parser/parse-mdx.ts';
import { projectMdxReader } from '../server/read-mdx.ts';
import {
  openDocsPage,
  openDocsPageFromSource,
  staticStoryBindings,
  type IndexedEntry,
} from './docs-page.ts';
import type { DocsArticleModel, StoryArgs } from './page-model.ts';
import type { ChannelState } from './channel-router.ts';

export type StaticMdxManifest = {
  pages: Record<string, { source: string; stories: IndexedEntry[] }>;
};

export async function buildStaticMdxManifest(input: {
  projectRoot: string;
  docsFiles: string[];
  entries: IndexedEntry[];
  readFile: (absolutePath: string) => Promise<string>;
}): Promise<StaticMdxManifest> {
  const read = projectMdxReader(input.projectRoot, input.readFile);
  const pages: StaticMdxManifest['pages'] = {};
  for (const file of input.docsFiles) {
    const source = await read(file);
    let stories: IndexedEntry[] = [];
    try {
      stories = staticStoryBindings(file, parseManagerDocs(source, file), input.entries);
    } catch (error) {
      if (!(error instanceof ManagerDocsParseError)) {
        throw error;
      }
    }
    pages[file] = { source, stories };
  }
  return { pages };
}

export function parseStaticMdxManifest(json: string): StaticMdxManifest {
  const parsed = JSON.parse(json) as unknown;
  if (!isRecord(parsed) || !isRecord(parsed.pages)) {
    throw new ManagerDocsError('Static MDX manifest is not an object of pages.');
  }
  const pages: StaticMdxManifest['pages'] = {};
  for (const [file, page] of Object.entries(parsed.pages)) {
    if (!isRecord(page) || typeof page.source !== 'string' || !Array.isArray(page.stories)) {
      throw new ManagerDocsError(
        `Static MDX manifest page "${file}" is missing source or stories.`
      );
    }
    pages[file] = {
      source: page.source,
      stories: page.stories.map((story) => storyBinding(file, story)),
    };
  }
  return { pages };
}

export function openDocsPageFromManifest(
  manifest: StaticMdxManifest,
  file: string,
  globals: StoryArgs
): { model: DocsArticleModel; channelState: ChannelState; source: string } {
  const page = manifest.pages[file];
  if (!page) {
    throw new ManagerDocsError(`No static MDX for "${file}".`);
  }
  return openDocsPageFromSource({
    file,
    source: page.source,
    entries: page.stories,
    globals,
  });
}

export async function loadDocsArticle(input: {
  file: string;
  globals: StoryArgs;
  entries: IndexedEntry[];
  channel: ChannelLike;
  production: boolean;
  readManifest: () => Promise<StaticMdxManifest>;
}): Promise<{ model: DocsArticleModel; channelState: ChannelState; source: string }> {
  if (input.production) {
    return openDocsPageFromManifest(await input.readManifest(), input.file, input.globals);
  }
  return openDocsPage({
    file: input.file,
    channel: input.channel,
    entries: input.entries,
    globals: input.globals,
  });
}

export async function fetchStaticMdxManifest(
  href = `./${STATIC_MDX_MANIFEST_FILE}`
): Promise<StaticMdxManifest> {
  const response = await fetch(href);
  if (!response.ok) {
    throw new ManagerDocsError(`Could not read ${href} (${response.status}).`);
  }
  return parseStaticMdxManifest(await response.text());
}

function storyBinding(file: string, story: unknown): IndexedEntry {
  if (!isRecord(story) || typeof story.id !== 'string' || typeof story.importPath !== 'string') {
    throw new ManagerDocsError(
      `Static MDX manifest page "${file}" has a story binding without an id.`
    );
  }
  if (typeof story.exportName !== 'string') {
    throw new ManagerDocsError(
      `Static MDX manifest page "${file}" has a story binding without an export name.`
    );
  }
  return {
    type: 'story',
    id: story.id,
    importPath: story.importPath,
    exportName: story.exportName,
    ...(isRecord(story.args) ? { args: story.args } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
