import { writeFile } from 'node:fs/promises';
import { basename } from 'pathe';

import type { ChannelLike } from '@storybook/core/internal/channels';
import { STORY_INDEX_INVALIDATED } from '@storybook/core/internal/core-events';
import { logger } from '@storybook/core/internal/node-logger';
import type { NormalizedStoriesSpecifier, StoryIndex } from '@storybook/core/internal/types';

import { debounce } from 'es-toolkit/function';
import type { Polka } from 'polka';

import type { StoryIndexGenerator } from '@storybook/core/internal/story-index';
import {
  watchConfig,
  watchStorySpecifiers,
} from '@storybook/core/internal/deep/story-index/watch-story-specifiers';

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
  channel,
  normalizedStories,
  onRegenerated,
}: {
  app: Polka;
  storyIndexGeneratorPromise: Promise<StoryIndexGenerator>;
  channel: ChannelLike;
  workingDir?: string;
  configDir?: string;
  normalizedStories: NormalizedStoriesSpecifier[];
  /**
   * Receives the index rebuilt after a watched change, once per new index. Regeneration is eager
   * here, which costs nothing extra: clients refetch the index on the same invalidation event.
   */
  onRegenerated?: (index: StoryIndex) => unknown;
}) {
  let disposed = false;
  let lastNotified: StoryIndex | undefined;
  const regenerate = async (): Promise<void> => {
    let index: StoryIndex;
    try {
      index = await (await storyIndexGeneratorPromise).getIndex();
    } catch {
      // The generator already reported the indexing error.
      return;
    }
    // The generator returns the same object until the next invalidation.
    if (disposed || index === lastNotified) {
      return;
    }
    lastNotified = index;
    try {
      await onRegenerated!(index);
    } catch (error) {
      logger.warn(`A listener for the regenerated story index failed: ${String(error)}`);
    }
  };
  const maybeInvalidate = debounce(
    () => {
      if (!disposed) {
        channel.emit(STORY_INDEX_INVALIDATED);
        if (onRegenerated) {
          void regenerate();
        }
      }
    },
    DEBOUNCE,
    { edges: ['leading', 'trailing'] }
  );
  const stopStories = watchStorySpecifiers(
    normalizedStories,
    { workingDir },
    async (path, removed) => {
      const generator = await storyIndexGeneratorPromise;
      if (disposed) {
        return;
      }
      generator.invalidate(path, removed);
      maybeInvalidate();
    }
  );
  const stopConfig = configDir
    ? watchConfig(configDir, async (filePath) => {
        if (basename(filePath).startsWith('preview')) {
          const generator = await storyIndexGeneratorPromise;
          if (disposed) {
            return;
          }
          generator.invalidateAll();
          maybeInvalidate();
        }
      })
    : undefined;

  app.use('/index.json', async (_req, res) => {
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
  return (): void => {
    disposed = true;
    stopStories();
    stopConfig?.();
    maybeInvalidate.cancel();
  };
}
