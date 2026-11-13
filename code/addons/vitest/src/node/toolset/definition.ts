import * as v from 'valibot';

import {
  moduleGraphAccessFromCtx,
  storyInputArraySchema,
  type StoryIndexAccess,
  type StoryInput,
} from 'storybook/internal/core-server';
import {
  defineToolset,
  type ToolsetCtx,
  type ToolsetDefinition,
  type ToolsetMethod,
  type ToolsetOutcome,
  type ToolsetTelemetryReport,
} from 'storybook/open-service';

import {
  countTestRunFailures,
  formatTestRun,
  ranNothingSelected,
  summarizeTestRun,
} from './format.ts';
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

/** What `files`, `changed` and `stories` selected, for the summary line. */
const selectionSchema = v.object({
  files: v.optional(v.object({ filters: v.array(v.string()), storyFiles: v.number() })),
  changed: v.optional(
    v.object({
      since: v.optional(v.string()),
      changedFiles: v.number(),
      /** The changed file that affects every story, when one did. */
      everyStory: v.optional(v.string()),
      storyFiles: v.optional(v.number()),
    })
  ),
  /** Stories the run was asked for; absent when the selection is every story. */
  storyCount: v.optional(v.number()),
});

const testRunOutputSchema = v.variant('status', [
  v.object({
    status: v.literal('no-stories'),
    /** Why the selection is empty when that is a mistake; empty when nothing was affected. */
    notFoundMessages: v.array(v.string()),
    selection: v.optional(selectionSchema),
  }),
  v.object({
    status: v.literal('completed'),
    result: testRunResultSchema,
    selection: v.optional(selectionSchema),
    /** Story ids that matched nothing. The rest ran, but they fail the call. */
    notFound: v.optional(v.array(v.string())),
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
export type TestRunSelection = v.InferOutput<typeof selectionSchema>;

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
        `Story files to test, as Vitest file filters: each entry selects the story files whose path, relative to the Storybook project directory, contains it (case-insensitive), or that an absolute path or directory points to. Only story files match; to test the stories that depend on a changed component, use \`changed\`.`
      )
    )
  ),
  changed: v.optional(
    v.pipe(
      v.union([v.boolean(), v.string(), v.pipe(v.number(), v.transform(String))]),
      v.description(
        `Test the stories affected by the files git reports as changed, as Vitest's --changed: true for the uncommitted changes (staged, unstaged and untracked), or a ref (a branch or commit) for the changes since it plus the uncommitted ones. A changed story file selects its stories, any other changed file the stories that depend on it, and a change to what the Storybook preview loads, a package.json or a vite or vitest config selects every story.`
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
type RunInput = {
  stories?: StoryInput[];
  files?: string[];
  changed?: boolean | string;
  a11y: boolean;
};

export type TestToolset = ToolsetDefinition<
  'test',
  {
    run: ToolsetMethod<
      v.GenericSchema<
        {
          stories?: StoryInput[];
          files?: string[];
          changed?: boolean | string | number;
          a11y?: boolean;
        },
        RunInput
      >,
      ToolsetOutcome<TestRunSuccessData, TestRunFailureData>
    >;
  }
>;

/**
 * The accessibility half of this tool's contract only holds when addon-a11y is enabled, so the
 * promise is dropped from the description rather than made and then broken.
 */
function describeRun(a11yEnabled: boolean): string {
  return (
    `Run story tests. It is the only way to run them: never a package.json test script or vitest directly.
Run them after editing anything that changes how the UI looks — components, stories, styles, CSS, themes, colors, or design tokens — shell-level substitutes like typecheck, lint, or package.json test scripts do not replace this.
Use changed for focused runs on what you changed (faster while iterating), or files for specific story files,
and leave all of them out to run every story for full-project verification.
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
  const changed = !input.changed
    ? {}
    : { changed: input.changed === true ? 'uncommitted' : 'since-ref' };

  if (data.status === 'no-stories') {
    return {
      payload: {
        runA11y: data.a11y,
        inputStoryCount,
        inputFileCount,
        ...changed,
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
      ...changed,
      // The stories the run was asked for; a full run falls back to the input count.
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
      return (
        Object.values(countTestRunFailures(data.result, data.a11y)).some((count) => count > 0) ||
        (data.notFound?.length ?? 0) > 0 ||
        ranNothingSelected(data.result)
      );
    case 'no-stories':
      // A filter or id that matched nothing fails, as in Vitest; `changed` affecting nothing passes.
      return data.notFoundMessages.length > 0;
    default: {
      // Type-only: a new status must decide its own pass/fail rather than falling through.
      const _exhaustive: never = data;
      return _exhaustive;
    }
  }
}

// A realm without the module graph (an older core, a builder without change detection) reports
// that as the reason `changed` cannot find dependent stories, not as a crash.
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
        description: () => describeRun(a11yEnabled),
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
              changed: input.changed,
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
