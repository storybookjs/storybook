import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';
import type { NormalizedStoriesSpecifier } from 'storybook/internal/types';

import { debounce } from 'es-toolkit/function';
import type { Polka } from 'polka';

import type { StoryIndexGenerator } from './StoryIndexGenerator';
import type { ServerChannel } from './get-server-channel';
import { watchStorySpecifiers } from './watch-story-specifiers';
import { watchConfig } from './watchConfig';

export const DEBOUNCE = 100;

export async function writeIndexJson(
  outputFile: string,
  initializedStoryIndexGenerator: Promise<StoryIndexGenerator>
) {
  const generator = await initializedStoryIndexGenerator;
  const storyIndex = await generator.getIndex();
  await writeFile(outputFile, JSON.stringify(storyIndex));
}

export function registerIndexJsonRoute({
  app,
  storyIndexGeneratorPromise,
  workingDir = process.cwd(),
  configDir,
  serverChannel,
  normalizedStories,
}: {
  app: Polka;
  storyIndexGeneratorPromise: Promise<StoryIndexGenerator>;
  serverChannel: ServerChannel;
  workingDir?: string;
  configDir?: string;
  normalizedStories: NormalizedStoriesSpecifier[];
}) {
  const maybeInvalidate = debounce(() => serverChannel.emit(STORY_INDEX_INVALIDATED), DEBOUNCE, {
    edges: ['leading', 'trailing'],
  });
  watchStorySpecifiers(normalizedStories, { workingDir }, async (path, removed) => {
    (await storyIndexGeneratorPromise).invalidate(path, removed);
    maybeInvalidate();
  });
  if (configDir) {
    watchConfig(configDir, async (filePath) => {
      if (basename(filePath).startsWith('preview')) {
        (await storyIndexGeneratorPromise).invalidateAll();
        maybeInvalidate();
      }
    });
  }

  app.use('/index.json', async (req, res) => {
    try {
      const index = await (await storyIndexGeneratorPromise).getIndex();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept'
      );
      res.end(JSON.stringify(index));
    } catch (err) {
      res.statusCode = 500;
      res.end(err instanceof Error ? err.toString() : String(err));
    }
  });
}
