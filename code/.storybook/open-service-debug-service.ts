import * as v from 'valibot';

import type { StorybookConfigRaw } from 'storybook/internal/types';
import { logger } from 'storybook/internal/node-logger';

import {
  describeService,
  defineCommand,
  defineQuery,
  defineService,
  registerService,
} from 'storybook/internal/core-server';

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

type StoryIndexGeneratorInstance = NonNullable<StorybookConfigRaw['storyIndexGenerator']>;

function createDebugServiceDef(storyIndexGeneratorPromise: Promise<StoryIndexGeneratorInstance>) {
  return defineService({
    id: DEBUG_SERVICE_ID,
    description:
      'Exercises Storybook open-service registration, queries, commands, preloads, subscriptions, static builds, and story-index integration inside the internal Storybook.',
    initialState: {
      activity: [],
      preloadedByEntryId: {},
      lastObservedValue: null,
      storyIndexEntryCount: 0,
      storyIndexSampleIds: [],
    } satisfies DebugServiceState,
    queries: {
      getActivity: defineQuery<DebugServiceState>()({
        description: 'Returns the latest activity entries for the debug service.',
        input: activityQueryInputSchema,
        output: v.array(v.string()),
        handler: async (input, ctx) => {
          logger.info('[open-service debug] query getActivity');
          return ctx.self.state.activity.slice(-input.limit);
        },
      }),
      getStoryIndexSummary: defineQuery<DebugServiceState>()({
        description: 'Returns story-index-derived summary data captured by the debug service.',
        input: storyIndexSummaryInputSchema,
        output: storyIndexSummaryOutputSchema,
        handler: async (input, ctx) => {
          logger.info('[open-service debug] query getStoryIndexSummary');
          return {
            entryCount: ctx.self.state.storyIndexEntryCount,
            sampleIds: input.includeSampleIds ? ctx.self.state.storyIndexSampleIds : [],
          };
        },
      }),
      getPreloadedValue: defineQuery<DebugServiceState>()({
        description:
          'Returns a preloaded value for one entry id and participates in static builds.',
        input: entryInputSchema,
        output: v.nullable(v.string()),
        preload: async (input, ctx) => {
          logger.info(`[open-service debug] preload getPreloadedValue(${input.entryId})`);
          if (ctx.self.state.preloadedByEntryId[input.entryId] !== undefined) {
            return;
          }

          await ctx.self.commands.recordPreloadVisit({
            entryId: input.entryId,
            source: 'preload',
          });
        },
        static: {
          inputs: async () => [{ entryId: 'static-a' }, { entryId: 'static-b' }],
          path: (input) => `debug-service/${input.entryId}.json`,
        },
        handler: async (input, ctx) => {
          const value = ctx.self.state.preloadedByEntryId[input.entryId] ?? null;

          logger.info(
            `[open-service debug] query getPreloadedValue(${input.entryId}) => ${value}`
          );
          return value;
        },
      }),
    },
    commands: {
      addActivity: defineCommand<DebugServiceState>()({
        description: 'Appends one entry to the debug activity log.',
        input: messageInputSchema,
        output: v.undefined(),
        handler: async (input, ctx) => {
          logger.info(`[open-service debug] command addActivity(${input.message})`);
          ctx.self.setState((draft) => {
            draft.activity.push(input.message);
          });

          return undefined;
        },
      }),
      syncStoryIndex: defineCommand<DebugServiceState>()({
        description: 'Reads the current story index and stores a compact summary in service state.',
        input: syncStoryIndexInputSchema,
        output: v.undefined(),
        handler: async (input, ctx) => {
          const storyIndex = await (await storyIndexGeneratorPromise).getIndex();
          const sampleIds = Object.keys(storyIndex.entries).slice(0, 5);

          logger.info(
            `[open-service debug] command syncStoryIndex(${input.reason}) => ${Object.keys(storyIndex.entries).length} entries`
          );
          ctx.self.setState((draft) => {
            draft.storyIndexEntryCount = Object.keys(storyIndex.entries).length;
            draft.storyIndexSampleIds = sampleIds;
            draft.activity.push(`syncStoryIndex:${input.reason}:${sampleIds.length}`);
          });

          return undefined;
        },
      }),
      recordPreloadVisit: defineCommand<DebugServiceState>()({
        description: 'Stores a generated value for one entry id and records the visit.',
        input: preloadVisitInputSchema,
        output: v.undefined(),
        handler: async (input, ctx) => {
          const selfService = await ctx.getService(DEBUG_SERVICE_ID);
          const summary = (await selfService.queries.getStoryIndexSummary({
            includeSampleIds: false,
          })) as { entryCount: number; sampleIds: string[] };
          const value = `${input.source}:${input.entryId}:${summary.entryCount}`;

          logger.info(
            `[open-service debug] command recordPreloadVisit(${input.entryId}, ${input.source}) => ${value}`
          );
          ctx.self.setState((draft) => {
            draft.preloadedByEntryId[input.entryId] = value;
            draft.lastObservedValue = value;
            draft.activity.push(`recordPreloadVisit:${input.entryId}:${input.source}`);
          });

          return undefined;
        },
      }),
    },
  });
}

/**
 * Registers the internal Storybook debug service that exercises the server-side open-service
 * features in one place.
 *
 * The service self-demonstrates queries, commands, preloads, subscriptions, static snapshot
 * generation, and story-index integration inside the internal Storybook.
 */
export async function registerOpenServiceDebugService(
  storyIndexGeneratorPromise: Promise<StoryIndexGeneratorInstance>
): Promise<void> {
  try {
    await describeService(DEBUG_SERVICE_ID);
    logger.info('[open-service debug] debug service already registered');
    return;
  } catch {
    // The service is not registered yet in this process.
  }

  const service = registerService(createDebugServiceDef(storyIndexGeneratorPromise));
  const descriptor = await describeService(DEBUG_SERVICE_ID);

  logger.info('[open-service debug] registered service descriptor');
  logger.info(JSON.stringify(descriptor, null, 2));

  const unsubscribe = service.queries.getPreloadedValue.subscribe(
    { entryId: 'startup' },
    (value) => {
      logger.info(`[open-service debug] subscription getPreloadedValue(startup) => ${value}`);
    }
  );

  // Trigger the main runtime behaviors once during registration so debug logs immediately show
  // the command, query, preload, and subscription paths without extra manual setup.
  await service.commands.syncStoryIndex({ reason: 'services-preset' });
  await service.commands.addActivity({ message: 'registered via services preset' });
  await service.queries.getActivity({ limit: 10 });
  await service.queries.getStoryIndexSummary({ includeSampleIds: true });
  await service.queries.getPreloadedValue({ entryId: 'startup' });
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  unsubscribe();
}
