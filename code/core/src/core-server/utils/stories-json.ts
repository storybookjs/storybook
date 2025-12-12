import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createGzip } from 'node:zlib';

import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';
import type { Options } from 'storybook/internal/types';
import type { NormalizedStoriesSpecifier, StoryIndex } from 'storybook/internal/types';

import { debounce } from 'es-toolkit/function';
import type { Polka } from 'polka';
import { SitemapStream, streamToPromise } from 'sitemap';

import { logger } from '../../node-logger';
import type { BuildStaticStandaloneOptions } from '../build-static';
import type { StoryIndexGenerator } from './StoryIndexGenerator';
import type { ServerChannel } from './get-server-channel';
import { getServerAddresses } from './server-address';
import { watchStorySpecifiers } from './watch-story-specifiers';
import { watchConfig } from './watchConfig';

export const DEBOUNCE = 100;
let cachedSitemap: Buffer | undefined;

async function generateSitemap(
  initializedStoryIndexGenerator: Promise<StoryIndexGenerator>,
  networkAddress: string,
  isProduction: boolean
): Promise<Buffer | undefined> {
  const generator = await initializedStoryIndexGenerator;
  const index = await generator.getIndex();

  const smStream = new SitemapStream({ hostname: networkAddress });
  // const smStream = new SitemapStream();
  const pipeline = isProduction ? smStream : smStream.pipe(createGzip());

  const now = new Date();

  // static settings pages; those with backlinks to storybook.js.org are the most important.
  smStream.write({ url: './?path=/settings/about', lastmod: now, priority: 1 });
  smStream.write({ url: './?path=/settings/whats-new', lastmod: now, priority: 1 });
  smStream.write({ url: './?path=/settings/guide', lastmod: now, priority: 0.3 });
  smStream.write({ url: './?path=/settings/shortcuts', lastmod: now, priority: 0.3 });
  smStream.write({ url: './index.json', lastmod: now, priority: 0.3 });
  smStream.write({ url: './project.json', lastmod: now, priority: 0.3 });

  // entries from story index; we prefer indexing docs over stories
  const entries = Object.values(index.entries || {});
  for (const entry of entries) {
    if (entry.type === 'docs') {
      smStream.write({ url: `./?path=/docs/${entry.id}`, lastmod: now, priority: 0.9 });
    } else if (entry.type === 'story' && entry.subtype !== 'test') {
      smStream.write({ url: `./?path=/story/${entry.id}`, lastmod: now, priority: 0.5 });
    }
  }

  smStream.end();

  // await and cache the gzipped buffer
  return streamToPromise(pipeline);
}

export async function extractStoriesJson(
  outputFile: string,
  initializedStoryIndexGenerator: Promise<StoryIndexGenerator>,
  transform?: (index: StoryIndex) => any
) {
  const generator = await initializedStoryIndexGenerator;
  const storyIndex = await generator.getIndex();
  await writeFile(outputFile, JSON.stringify(transform ? transform(storyIndex) : storyIndex));
}

export async function extractSitemap(
  outputFile: string,
  initializedStoryIndexGenerator: Promise<StoryIndexGenerator>,
  options: BuildStaticStandaloneOptions
) {
  const { siteUrl } = options;

  // Can't generate a sitemap for the static build without knowing the host.
  if (!siteUrl) {
    logger.info(`Not building sitemap (\`siteUrl\` option not set).`);
    return;
  }

  let normalizedUrl = siteUrl;
  if (!siteUrl.endsWith('/')) {
    normalizedUrl += '/';
  }
  if (!siteUrl.startsWith('http://') && !siteUrl.startsWith('https://')) {
    let protocol = 'http';
    if (
      options.https ||
      // Vercel always deploys to HTTPS but forgets to pass the protocol in its
      // environment variable. If the siteUrl was populated from Vercel env, we
      // must assume HTTPS.
      (options.https === undefined && process.env.VERCEL_PROJECT_PRODUCTION_URL)
    ) {
      protocol = 'https';
    }
    normalizedUrl = `${protocol}://${normalizedUrl}`;
  }

  logger.info('Building sitemap..');
  const sitemapBuffer = await generateSitemap(initializedStoryIndexGenerator, normalizedUrl, true);
  if (sitemapBuffer) {
    await writeFile(outputFile, sitemapBuffer.toString('utf-8'));
  }
}

export function useStoriesJson({
  app,
  initializedStoryIndexGenerator,
  workingDir = process.cwd(),
  configDir,
  serverChannel,
  normalizedStories,
}: {
  app: Polka;
  initializedStoryIndexGenerator: Promise<StoryIndexGenerator>;
  serverChannel: ServerChannel;
  workingDir?: string;
  configDir?: string;
  normalizedStories: NormalizedStoriesSpecifier[];
  options: Options;
}) {
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
}

export function useSitemap(
  app: Polka,
  initializedStoryIndexGenerator: Promise<StoryIndexGenerator>,
  options: Options
) {
  app.use('/sitemap.xml', async (req, res) => {
    try {
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Encoding', 'gzip');

      // serve cached gzip if available
      if (cachedSitemap) {
        res.end(cachedSitemap);
        return;
      }

      const { port = 80, host } = options;

      const proto = options.https ? 'https' : 'http';
      const { networkAddress } = getServerAddresses(port, host, proto);

      const sitemapBuffer = await generateSitemap(
        initializedStoryIndexGenerator,
        networkAddress,
        false
      );
      cachedSitemap = sitemapBuffer;
      res.end(sitemapBuffer);
    } catch (err) {
      res.statusCode = 500;
      res.end(err instanceof Error ? err.toString() : String(err));
    }
  });
}
