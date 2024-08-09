import { basename } from 'node:path';

import type { NormalizedStoriesSpecifier, StoryIndex } from '@storybook/core/types';

import { STORY_INDEX_INVALIDATED } from '@storybook/core/core-events';

import { writeJSON } from '@ndelangen/fs-extra-unified';
import type { Request, Response, Router } from 'express';
import debounce from 'lodash/debounce.js';

import type { StoryIndexGenerator } from './StoryIndexGenerator';
import type { ServerChannel } from './get-server-channel';
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
  await writeJSON(outputFile, transform ? transform(storyIndex) : storyIndex);
}

export function useStoriesJson({
  router,
  initializedStoryIndexGenerator,
  workingDir = process.cwd(),
  configDir,
  serverChannel,
  normalizedStories,
}: {
  router: Router;
  initializedStoryIndexGenerator: Promise<StoryIndexGenerator>;
  serverChannel: ServerChannel;
  workingDir?: string;
  configDir?: string;
  normalizedStories: NormalizedStoriesSpecifier[];
}) {
  const maybeInvalidate = debounce(() => serverChannel.emit(STORY_INDEX_INVALIDATED), DEBOUNCE, {
    leading: true,
  });
  watchStorySpecifiers(normalizedStories, { workingDir }, async (specifier, path, removed) => {
    const generator = await initializedStoryIndexGenerator;
    generator.invalidate(specifier, path, removed);
    maybeInvalidate();
  });
  if (configDir) {
    watchConfig(configDir, async (filePath) => {
      if (basename(filePath).startsWith('preview')) {
        const generator = await initializedStoryIndexGenerator;
        generator.invalidateAll();
        maybeInvalidate();
      }
    });
  }

  router.use('/index.json', async (req: Request, res: Response) => {
    try {
      const generator = await initializedStoryIndexGenerator;
      const index = await generator.getIndex();
      res.header('Content-Type', 'application/json');
      res.send(JSON.stringify(index));
    } catch (err) {
      res.status(500);
      res.send(err instanceof Error ? err.toString() : String(err));
    }
  });
}
