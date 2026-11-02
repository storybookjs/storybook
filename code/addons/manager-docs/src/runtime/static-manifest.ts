import { openDocsPage, type IndexedEntry } from './docs-page.ts';
import { readMdxSourceFromService } from './mdx-source.ts';
import type { DocsArticleModel, StoryArgs } from './page-model.ts';
import type { ChannelState } from './channel-router.ts';

export async function loadDocsArticle(input: {
  file: string;
  globals: StoryArgs;
  entries: IndexedEntry[];
}): Promise<{ model: DocsArticleModel; channelState: ChannelState; source: string }> {
  return openDocsPage({
    file: input.file,
    entries: input.entries,
    globals: input.globals,
    readSource: readMdxSourceFromService,
  });
}
