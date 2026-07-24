import * as v from 'valibot';

import { defineApi } from '../../../public-api/index.ts';
import type { StoryIndexAccess } from '../stories/definition.ts';
import { storyInputArraySchema } from '../stories/story-input.ts';
import { formatTestRun } from './format.ts';
import { createAsyncQueue, runStoryTests, type TestChannel } from './run.ts';

const errorLikeSchema: v.GenericSchema = v.object({
  message: v.string(),
  name: v.optional(v.string()),
  stack: v.optional(v.string()),
  cause: v.optional(v.lazy(() => errorLikeSchema)),
});

const statusSchema = v.looseObject({
  value: v.string(),
  typeId: v.string(),
  storyId: v.string(),
  title: v.string(),
  description: v.string(),
});

/**
 * Addon-vitest `CurrentRun`-compatible result. Kept intentionally loose on nested report payloads
 * so the service contract stays stable across a11y/report shape tweaks.
 */
const testRunResultSchema = v.object({
  triggeredBy: v.optional(v.any()),
  config: v.record(v.string(), v.any()),
  componentTestStatuses: v.array(statusSchema),
  a11yStatuses: v.array(statusSchema),
  componentTestCount: v.object({
    success: v.number(),
    error: v.number(),
  }),
  a11yCount: v.object({
    success: v.number(),
    warning: v.number(),
    error: v.number(),
  }),
  a11yReports: v.record(v.string(), v.array(v.any())),
  reports: v.record(v.string(), v.array(v.any())),
  totalTestCount: v.optional(v.number()),
  storyIds: v.optional(v.array(v.string())),
  startedAt: v.optional(v.number()),
  finishedAt: v.optional(v.number()),
  unhandledErrors: v.array(v.any()),
  coverageSummary: v.optional(
    v.object({
      status: v.union([
        v.literal('positive'),
        v.literal('warning'),
        v.literal('negative'),
        v.literal('unknown'),
      ]),
      percentage: v.number(),
    })
  ),
});

const testRunOutputSchema = v.variant('status', [
  v.object({
    status: v.literal('no-stories'),
  }),
  v.object({
    status: v.literal('completed'),
    result: testRunResultSchema,
  }),
  v.object({
    status: v.literal('error'),
    error: v.object({
      message: v.string(),
      error: v.optional(errorLikeSchema),
    }),
  }),
  v.object({
    status: v.literal('cancelled'),
  }),
]);

export type TestRunResult = v.InferOutput<typeof testRunResultSchema>;
export type TestRunOutput = v.InferOutput<typeof testRunOutputSchema>;

export type CreateTestApiOptions = {
  channel: TestChannel;
  storyIndex: StoryIndexAccess;
};

/**
 * Creates the public test API. Each registration owns a queue because addon-vitest supports one
 * live test run at a time.
 */
export function createTestApi({ channel, storyIndex }: CreateTestApiOptions) {
  const queue = createAsyncQueue();

  return defineApi({
    id: 'test',
    description: 'Run Storybook story tests via addon-vitest.',
    methods: {
      run: {
        schema: v.object({
          stories: v.optional(
            v.pipe(
              storyInputArraySchema,
              v.description('Stories to test. Omit to run all available stories.')
            )
          ),
          a11y: v.optional(
            v.pipe(
              v.boolean(),
              v.description('Whether to include accessibility tests. Defaults to true.')
            ),
            true
          ),
          json: v.optional(
            v.pipe(
              v.boolean(),
              v.description('When true, return structured JSON instead of Markdown.')
            ),
            false
          ),
        }),
        description:
          'Runs story tests for the given selectors, or all stories when stories is omitted.',
        handler: async (input) => {
          const done = await queue.wait();
          try {
            const result = await runStoryTests({
              channel,
              getIndex: storyIndex.getIndex,
              stories: input.stories,
              a11y: input.a11y,
            });
            return input.json ? result : formatTestRun(result);
          } finally {
            done();
          }
        },
      },
    },
  });
}

export type TestApi = ReturnType<typeof createTestApi>;
