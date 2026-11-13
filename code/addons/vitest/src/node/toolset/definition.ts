import * as v from 'valibot';

import {
  moduleGraphAccessFromCtx,
  storyInputArraySchema,
  type StoryIndexAccess,
  type StoryInput,
} from 'storybook/internal/core-server';
import {
  defineToolset,
  getSkillCommand,
  type ToolsetCtx,
  type ToolsetDefinition,
  type ToolsetMethod,
  type ToolsetOutcome,
  type ToolsetTelemetryReport,
} from 'storybook/open-service';

import { countTestRunFailures, formatTestRun, summarizeTestRun } from './format.ts';
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

const fileSelectionSchema = v.object({
  file: v.string(),
  kind: v.pipe(
    v.picklist(['story-file', 'component']),
    v.description(
      '`story-file`: the stories in that file. `component`: the stories, in any story file, that depend on it.'
    )
  ),
  storyIds: v.array(v.string()),
  storyFiles: v.array(v.string()),
});

const testRunOutputSchema = v.variant('status', [
  v.object({
    status: v.literal('no-stories'),
    /** Per-selector lookup failures. When nothing matched, they are the whole answer. */
    notFoundMessages: v.array(v.string()),
  }),
  v.object({
    status: v.literal('completed'),
    result: testRunResultSchema,
    /** How each `files` entry selected its stories; absent when `files` was not given. */
    files: v.optional(v.array(fileSelectionSchema)),
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

/**
 * What `run` renders: the run result plus whether accessibility tests were part of this run, which
 * the result payload itself does not state.
 */
export type TestRunData = TestRunOutput & { a11y: boolean };

/**
 * The outcome split for `test.run`, following the Vitest convention: only a run that completes
 * without failures succeeds. A failed outcome still carries its full report, so clients keying on
 * `ok` cannot count it as a pass while agents keep the diagnostic detail.
 */
export type TestRunSuccessData = Extract<TestRunOutput, { status: 'completed' | 'no-stories' }> & {
  a11y: boolean;
};

export type TestRunFailureData = Extract<
  TestRunOutput,
  { status: 'completed' | 'no-stories' | 'error' | 'cancelled' }
> & {
  a11y: boolean;
};

const runInputSchema = v.strictObject({
  stories: v.optional(
    v.pipe(
      storyInputArraySchema,
      v.description(
        `Stories to test for focused feedback. Omit this field and \`files\` to run tests for all available stories.
Prefer running tests for specific stories while developing to get faster feedback,
and omit it once before you finish, to verify every story.
Prefer { storyId } when you don't already have story file context, since this avoids filesystem discovery.
Use { storyId } when IDs were discovered from documentation tools.
Use { absoluteStoryPath + exportName } only when you're currently working in a story file and already know those values.`
      )
    )
  ),
  files: v.optional(
    v.pipe(
      v.array(v.string()),
      v.description(
        `Files to test, absolute or relative to the Storybook project directory. A story file (\`*.stories.*\`) runs the stories in that file and nothing else. Any other file, such as a component, runs every story that depends on it, at any import depth. Can be combined with \`stories\`; omit both to run every story.`
      )
    )
  ),
  a11y: v.optional(
    v.pipe(
      v.boolean(),
      v.description(
        'Whether to run accessibility tests. Defaults to true. Disable if you only need component test results.'
      )
    ),
    true
  ),
});

// Inferring this from the schema would make the exported toolset type unnameable in declaration
// output, because core's valibot types live in a private declaration chunk.
type RunInput = { stories?: StoryInput[]; files?: string[]; a11y: boolean };

export type TestToolset = ToolsetDefinition<
  'test',
  {
    run: ToolsetMethod<
      v.GenericSchema<{ stories?: StoryInput[]; files?: string[]; a11y?: boolean }, RunInput>,
      ToolsetOutcome<TestRunSuccessData, TestRunFailureData>
    >;
  }
>;

/**
 * The accessibility half of this tool's contract only holds when addon-a11y is enabled, so the
 * promise is dropped from the description rather than made and then broken.
 */
function describeRun(a11yEnabled: boolean, ctx: ToolsetCtx): string {
  const skill = getSkillCommand(ctx)('test-stories');
  return (
    `Run story tests.${skill ? `\nFirst run ${skill} once and follow it: it has the rules for running the tests and fixing what fails.` : ''}
Run them after editing anything that changes how the UI looks — components, stories, styles, CSS, themes, colors, or design tokens — shell-level substitutes like typecheck, lint, or package.json test scripts do not replace this.
Pass the story files or component files you changed in files for focused runs (faster while iterating),
or omit files and stories to run all tests for full-project verification.
Use this continuously to monitor test results as you work on your UI components and stories.
Results will include passing/failing status` +
    (a11yEnabled
      ? `, and accessibility violation reports.
For visual/design accessibility violations (for example color contrast), ask the user before changing styles.`
      : '.')
  );
}

/**
 * The report for a run that reached a verdict. A run that never got one — a channel error, a
 * cancellation — reports nothing, so the event counts runs whose numbers mean something.
 */
function runTelemetry(data: TestRunData, input: RunInput): ToolsetTelemetryReport | undefined {
  const inputStoryCount = input.stories?.length ?? 0;
  const inputFileCount = input.files?.length ?? 0;

  if (data.status === 'no-stories') {
    return {
      payload: {
        runA11y: data.a11y,
        inputStoryCount,
        inputFileCount,
        matchedStoryCount: 0,
        passingStoryCount: 0,
        failingStoryCount: 0,
        a11yViolationCount: 0,
        unhandledErrorCount: 0,
      },
    };
  }

  if (data.status !== 'completed') {
    return undefined;
  }

  return {
    payload: {
      runA11y: data.a11y,
      inputStoryCount,
      inputFileCount,
      // A partially resolved selector list never reaches a run, so every input matched by this point.
      matchedStoryCount: data.result.storyIds?.length ?? inputStoryCount,
      ...summarizeTestRun(data.result, data.a11y),
    },
  };
}

function isFailedRun(data: TestRunData): data is TestRunFailureData {
  switch (data.status) {
    case 'error':
    case 'cancelled':
      return true;
    case 'completed':
      return Object.values(countTestRunFailures(data.result, data.a11y)).some((count) => count > 0);
    case 'no-stories':
      // A selector that matched nothing is a failed request; an empty selector list is not.
      return data.notFoundMessages.length > 0;
    default: {
      // Type-only: a new status must decide its own pass/fail rather than falling through.
      const _exhaustive: never = data;
      return _exhaustive;
    }
  }
}

// A realm without the module graph (an older core, a builder without change detection) reports
// that as the reason a component file found no stories, not as a crash.
function getModuleGraph(ctx: ToolsetCtx) {
  try {
    return moduleGraphAccessFromCtx(ctx);
  } catch {
    return undefined;
  }
}

export type CreateTestToolsetOptions = {
  channel: TestChannel;
  storyIndex: StoryIndexAccess;
  /** Whether accessibility tests run alongside component tests (addon-a11y enabled). */
  a11yEnabled: boolean;
};

/**
 * Creates the public test API. Each registration owns a queue because addon-vitest supports one
 * live test run at a time.
 */
export function createTestToolset({
  channel,
  storyIndex,
  a11yEnabled,
}: CreateTestToolsetOptions): TestToolset {
  const queue = createAsyncQueue();

  return defineToolset({
    id: 'test',
    description: 'Run Storybook story tests via addon-vitest.',
    methods: {
      run: {
        input: runInputSchema,
        fileArguments: 'files',
        title: 'Run Storybook tests',
        description: (ctx) => describeRun(a11yEnabled, ctx),
        handler: async (
          input,
          ctx
        ): Promise<ToolsetOutcome<TestRunSuccessData, TestRunFailureData>> => {
          const done = await queue.wait();
          try {
            const output = await runStoryTests({
              channel,
              getIndex: storyIndex.getIndex,
              stories: input.stories,
              files: input.files,
              getModuleGraph: () => getModuleGraph(ctx),
              a11y: input.a11y,
            });
            const data: TestRunData = { ...output, a11y: input.a11y };
            const markdown = formatTestRun(data, ctx, { a11yEnabled });
            const telemetry = runTelemetry(data, input);
            return isFailedRun(data)
              ? { ok: false, data, markdown, telemetry }
              : { ok: true, data, markdown, telemetry };
          } finally {
            done();
          }
        },
      },
    },
  });
}
