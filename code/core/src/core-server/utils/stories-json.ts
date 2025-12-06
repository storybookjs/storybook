import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createGzip } from 'node:zlib';

import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';
import type { Options } from 'storybook/internal/types';
import type { NormalizedStoriesSpecifier, StoryIndex } from 'storybook/internal/types';

import { debounce } from 'es-toolkit/function';
import type { Polka } from 'polka';
import { SitemapStream, streamToPromise } from 'sitemap';
import invariant from 'tiny-invariant';

import type { StoryIndexGenerator } from './StoryIndexGenerator';
import type { ServerChannel } from './get-server-channel';
import { getServerAddresses } from './server-address';
import { watchStorySpecifiers } from './watch-story-specifiers';
import { watchConfig } from './watchConfig';

export const DEBOUNCE = 100;

export async function extractStoriesJson(
  outputFile: string,
  initializedStoryIndexGenerator: Promise<StoryIndexGenerator>,
  transform?: (index: StoryIndex) => any
) {
  const generator = await initializedStoryIndexGenerator;
  const storyIndex = await generator.getIndex();
  await writeFile(outputFile, JSON.stringify(transform ? transform(storyIndex) : storyIndex));
}

export function useStoriesJson({
  app,
  initializedStoryIndexGenerator,
  workingDir = process.cwd(),
  configDir,
  serverChannel,
  normalizedStories,
  options,
}: {
  app: Polka;
  initializedStoryIndexGenerator: Promise<StoryIndexGenerator>;
  serverChannel: ServerChannel;
  workingDir?: string;
  configDir?: string;
  normalizedStories: NormalizedStoriesSpecifier[];
  options: Options;
}) {
  let cachedSitemap: Buffer | undefined;

  const maybeInvalidate = debounce(() => serverChannel.emit(STORY_INDEX_INVALIDATED), DEBOUNCE, {
    edges: ['leading', 'trailing'],
  });
  watchStorySpecifiers(normalizedStories, { workingDir }, async (specifier, path, removed) => {
    const generator = await initializedStoryIndexGenerator;
    generator.invalidate(specifier, path, removed);
    cachedSitemap = undefined;
    maybeInvalidate();
  });
  if (configDir) {
    watchConfig(configDir, async (filePath) => {
      if (basename(filePath).startsWith('preview')) {
        const generator = await initializedStoryIndexGenerator;
        generator.invalidateAll();
        cachedSitemap = undefined;
        maybeInvalidate();
      }
    });
  }

  app.use('/index.json', async (req, res) => {
    try {
      const generator = await initializedStoryIndexGenerator;
      const index = await generator.getIndex();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(index));
    } catch (err) {
      res.statusCode = 500;
      res.end(err instanceof Error ? err.toString() : String(err));
    }
  });

  app.use('/sitemap.xml', async (req, res) => {
    try {
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Encoding', 'gzip');

      // serve cached gzip if available
      if (cachedSitemap) {
        res.end(cachedSitemap);
        return;
      }

      const generator = await initializedStoryIndexGenerator;
      const index = await generator.getIndex();

      const { port, host, initialPath } = options;
      invariant(port, 'expected options to have a port');
      const proto = options.https ? 'https' : 'http';
      const { networkAddress } = getServerAddresses(port, host, proto, initialPath);

      const smStream = new SitemapStream({ hostname: networkAddress });
      const pipeline = smStream.pipe(createGzip());

      const now = new Date();

      // static settings pages; those with backlinks to storybook.js.org are the most important.
      smStream.write({ url: '/?path=/settings/about', lastmod: now, priority: 1 });
      smStream.write({ url: '/?path=/settings/whats-new', lastmod: now, priority: 1 });
      smStream.write({ url: '/?path=/settings/guide', lastmod: now, priority: 0.3 });
      smStream.write({ url: '/?path=/settings/shortcuts', lastmod: now, priority: 0.3 });

      // entries from story index; we prefer indexing docs over stories
      const entries = Object.values(index.entries || {});
      for (const entry of entries) {
        if (entry.type === 'docs') {
          smStream.write({ url: `/?path=/docs/${entry.id}`, lastmod: now, priority: 0.9 });
        } else if (entry.type === 'story' && entry.subtype !== 'test') {
          smStream.write({ url: `/?path=/story/${entry.id}`, lastmod: now, priority: 0.5 });
        }
      }

      smStream.end();

      // await and cache the gzipped buffer
      cachedSitemap = await streamToPromise(pipeline);
      res.end(cachedSitemap);
    } catch (err) {
      res.statusCode = 500;
      res.end(err instanceof Error ? err.toString() : String(err));
    }
  });
}
