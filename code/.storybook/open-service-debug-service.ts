import * as v from 'valibot';

import { logger } from 'storybook/internal/node-logger';
import type { StoryIndexGenerator } from '../core/src/core-server/utils/StoryIndexGenerator.ts';

import { defineService } from 'storybook/open-service';
import { describeService, registerService } from '../core/src/shared/open-service/server.ts';

const DEBUG_SERVICE_ID = 'storybook/internal/open-service-debug';

type DebugServiceState = {
  activity: string[];
  preloadedByEntryId: Record<string, string>;
  lastObservedValue: string | null;
  storyIndexEntryCount: number;
  storyIndexSampleIds: string[];
};

const messageInputSchema = v.object({ message: v.string() });
const entryInputSchema = v.object({ entryId: v.string() });
const activityQueryInputSchema = v.object({ limit: v.number() });
const preloadVisitInputSchema = v.object({
  entryId: v.string(),
  source: v.string(),
});
const storyIndexSummaryInputSchema = v.object({ includeSampleIds: v.boolean() });
const storyIndexSummaryOutputSchema = v.object({
  entryCount: v.number(),
  sampleIds: v.array(v.string()),
});
const syncStoryIndexInputSchema = v.object({ reason: v.string() });

function createDebugServiceDef(storyIndexGeneratorPromise: Promise<StoryIndexGenerator>) {
  return defineService({
    id: DEBUG_SERVICE_ID,
    description:
      'Exercises Storybook open-service registration, queries, commands, loads, subscriptions, static builds, and story-index integration inside the internal Storybook.',
    initialState: {
      activity: [],
      preloadedByEntryId: {},
      lastObservedValue: null,
      storyIndexEntryCount: 0,
      storyIndexSampleIds: [],
    } as DebugServiceState,
    queries: {
      getActivity: {
        description: 'Returns the latest activity entries for the debug service.',
        input: activityQueryInputSchema,
        output: v.array(v.string()),
        handler: (input, ctx) => {
          logger.warn('[open-service debug] query getActivity');
          return ctx.self.state.activity.slice(-input.limit);
        },
      },
      getStoryIndexSummary: {
        description: 'Returns story-index-derived summary data captured by the debug service.',
        input: storyIndexSummaryInputSchema,
        output: storyIndexSummaryOutputSchema,
        handler: (input, ctx) => {
          logger.warn('[open-service debug] query getStoryIndexSummary');
          return {
            entryCount: ctx.self.state.storyIndexEntryCount,
            sampleIds: input.includeSampleIds ? ctx.self.state.storyIndexSampleIds : [],
          };
        },
      },
      getPreloadedValue: {
        description:
          'Returns a preloaded value for one entry id and participates in static builds.',
        input: entryInputSchema,
        output: v.nullable(v.string()),
        load: async (input, ctx) => {
          logger.warn(`[open-service debug] load getPreloadedValue(${input.entryId})`);
          if (ctx.self.state.preloadedByEntryId[input.entryId] !== undefined) {
            return;
          }

          await ctx.self.commands.recordPreloadVisit({
            entryId: input.entryId,
            source: 'load',
          });
        },
        staticPath: (input) => `${input.entryId}.json`,
        staticInputs: async () => [{ entryId: 'static-a' }, { entryId: 'static-b' }],
        handler: (input, ctx) => {
          const value = ctx.self.state.preloadedByEntryId[input.entryId] ?? null;

          logger.warn(`[open-service debug] query getPreloadedValue(${input.entryId}) => ${value}`);
          return value;
        },
      },
    },
    commands: {
      addActivity: {
        description: 'Appends one entry to the debug activity log.',
        input: messageInputSchema,
        output: v.undefined(),
        handler: async (input, ctx) => {
          logger.warn(`[open-service debug] command addActivity(${input.message})`);
          ctx.self.setState((state) => {
            state.activity.push(input.message);
          });

          return undefined;
        },
      },
      syncStoryIndex: {
        description: 'Reads the current story index and stores a compact summary in service state.',
        input: syncStoryIndexInputSchema,
        output: v.undefined(),
        handler: async (input, ctx) => {
          const storyIndex = await (await storyIndexGeneratorPromise).getIndex();
          const sampleIds = Object.keys(storyIndex.entries).slice(0, 5);

          logger.warn(
            `[open-service debug] command syncStoryIndex(${input.reason}) => ${Object.keys(storyIndex.entries).length} entries`
          );
          ctx.self.setState((state) => {
            state.storyIndexEntryCount = Object.keys(storyIndex.entries).length;
            state.storyIndexSampleIds = sampleIds;
            state.activity.push(`syncStoryIndex:${input.reason}:${sampleIds.length}`);
          });

          return undefined;
        },
      },
      recordPreloadVisit: {
        description: 'Stores a generated value for one entry id and records the visit.',
        input: preloadVisitInputSchema,
        output: v.undefined(),
        handler: async (input, ctx) => {
          const summary = ctx.self.queries.getStoryIndexSummary.get({
            includeSampleIds: false,
          });
          const value = `${input.source}:${input.entryId}:${summary.entryCount}`;

          logger.warn(
            `[open-service debug] command recordPreloadVisit(${input.entryId}, ${input.source}) => ${value}`
          );
          ctx.self.setState((state) => {
            state.preloadedByEntryId[input.entryId] = value;
            state.lastObservedValue = value;
            state.activity.push(`recordPreloadVisit:${input.entryId}:${input.source}`);
          });

          return undefined;
        },
      },
    },
  });
}

/**
 * Registers the internal Storybook debug service that exercises the server-side open-service
 * features in one place.
 *
 * The service self-demonstrates queries, commands, loads, subscriptions, static snapshot
 * generation, and story-index integration inside the internal Storybook. It is gated behind the
 * `STORYBOOK_OPEN_SERVICE_DEBUG=true` env flag in `code/.storybook/services-preset.ts`.
 */
export async function registerOpenServiceDebugService(
  storyIndexGeneratorPromise: Promise<StoryIndexGenerator>
): Promise<void> {
  const service = registerService(createDebugServiceDef(storyIndexGeneratorPromise));
  const descriptor = await describeService(DEBUG_SERVICE_ID);

  logger.warn('[open-service debug] registered service descriptor');
  logger.warn(JSON.stringify(descriptor, null, 2));

  const unsubscribe = service.queries.getPreloadedValue.subscribe(
    { entryId: 'startup' },
    ({ data }) => {
      logger.warn(`[open-service debug] subscription getPreloadedValue(startup) => ${data}`);
    }
  );

  try {
    // Trigger the main runtime behaviors once during registration so debug logs immediately show
    // the command, query, load, and subscription paths without extra manual setup.
    await service.commands.syncStoryIndex({ reason: 'services-preset' });
    await service.commands.addActivity({ message: 'registered via services preset' });
    service.queries.getActivity.get({ limit: 10 });
    service.queries.getStoryIndexSummary.get({ includeSampleIds: true });
    await service.queries.getPreloadedValue.loaded({ entryId: 'startup' });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  } finally {
    unsubscribe();
  }
}
