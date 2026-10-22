import { execFileSync } from 'node:child_process';

import {
  allTemplates,
  normal,
  type Template,
  type TemplateKey,
} from '../../code/lib/cli-storybook/src/sandbox-templates.ts';
import { isGlobalInput } from './affected-tests.ts';
import {
  build_linux,
  defineAffectedCheck,
  defineAffectedLintAndFormat,
  defineAffectedUnitTests,
  internalStorybookBuildE2e,
  internalStorybookE2e,
  storybookChromatic,
  testsStories_linux,
  testsUnit_linux,
} from './common-jobs.ts';
import { defineEmptyInitFeatures, defineEmptyInitFlow } from './init-empty.ts';
import { defineSandboxFlow, sandboxesNoOpJob } from './sandboxes.ts';
import { defineMcpTestStorybook, definePortableStoryTest } from './test-storybooks.ts';
import type { JobOrNoOpJob } from './utils/types.ts';

const DEFAULT_FOCUS_SANDBOX = 'react-vite/default-ts' satisfies TemplateKey;

/** Ordered by priority: a framework match picks the sandbox before a renderer or builder match. */
export const FOCUS_PATH_ROOTS = ['code/frameworks/', 'code/renderers/', 'code/builders/'] as const;

type FocusPathRoot = (typeof FOCUS_PATH_ROOTS)[number];

const isChangedUnder = (
  { focusPaths = [] }: Template,
  root: FocusPathRoot,
  changedFiles: readonly string[]
) =>
  focusPaths.some(
    (path) => path.startsWith(root) && changedFiles.some((file) => file.startsWith(path))
  );

/**
 * Select every public template that claims a changed path under the highest-priority root that
 * matches. Internal templates such as the benchmarks inherit `focusPaths` from the template they
 * extend, so they are never picked here.
 */
export function selectFocusSandboxes(changedFiles: readonly string[]): TemplateKey[] {
  for (const root of FOCUS_PATH_ROOTS) {
    const sandboxes = (Object.entries(allTemplates) as [TemplateKey, Template][])
      .filter(
        ([, template]) => !template.isInternal && isChangedUnder(template, root, changedFiles)
      )
      .map(([key]) => key);

    if (sandboxes.length > 0) {
      return sandboxes;
    }
  }

  return [DEFAULT_FOCUS_SANDBOX];
}

/** Select the PR-workflow templates that run Chromatic and whose renderer source changed. */
export function selectChromaticSiblings(
  focused: readonly TemplateKey[],
  changedFiles: readonly string[]
): TemplateKey[] {
  const changedRenderers = new Set(
    Object.values(allTemplates)
      .filter((candidate) => isChangedUnder(candidate, 'code/renderers/', changedFiles))
      .map(({ expected }) => expected.renderer)
  );

  return normal.filter(
    (sibling) =>
      !focused.includes(sibling) &&
      !allTemplates[sibling].skipTasks?.includes('chromatic') &&
      changedRenderers.has(allTemplates[sibling].expected.renderer)
  );
}

const INIT_PATHS = [
  'code/lib/create-storybook/',
  'code/lib/cli-storybook/',
  'code/core/src/cli/',
  'code/frameworks/react-vite/',
];

const INTERNAL_STORYBOOK_PATHS = [
  'code/core/src/manager/',
  'code/core/src/manager-api/',
  'code/core/src/components/',
  'code/core/src/theming/',
  'code/.storybook/',
  'code/e2e-internal/',
];

const portableStoryTest = (directory: string, sourcePath: string) => ({
  job: definePortableStoryTest(directory),
  paths: [
    sourcePath,
    'code/core/src/preview-api/',
    `test-storybooks/portable-stories-kitchen-sink/${directory}/`,
  ],
});

/** Jobs a focused run adds when the diff touches one of their paths or any global input. */
export const PATH_TRIGGERED_JOBS: readonly { job: JobOrNoOpJob; paths: readonly string[] }[] = [
  { job: defineEmptyInitFlow('react-vite-ts'), paths: INIT_PATHS },
  {
    job: defineEmptyInitFeatures(),
    paths: [...INIT_PATHS, 'code/addons/docs/', 'code/addons/vitest/', 'code/addons/a11y/'],
  },
  portableStoryTest('react', 'code/renderers/react/'),
  portableStoryTest('vue3', 'code/renderers/vue3/'),
  portableStoryTest('svelte', 'code/renderers/svelte/'),
  portableStoryTest('nextjs', 'code/frameworks/nextjs/'),
  {
    job: defineMcpTestStorybook(),
    paths: ['code/addons/mcp/', 'code/lib/mcp/', 'test-storybooks/mcp/'],
  },
  { job: internalStorybookE2e, paths: INTERNAL_STORYBOOK_PATHS },
  { job: internalStorybookBuildE2e, paths: INTERNAL_STORYBOOK_PATHS },
  { job: testsStories_linux, paths: INTERNAL_STORYBOOK_PATHS },
  { job: storybookChromatic, paths: INTERNAL_STORYBOOK_PATHS },
];

export const selectPathTriggeredJobs = (changedFiles: readonly string[]): JobOrNoOpJob[] =>
  PATH_TRIGGERED_JOBS.filter(({ paths }) =>
    changedFiles.some((file) => isGlobalInput(file) || paths.some((path) => file.startsWith(path)))
  ).map(({ job }) => job);

export function getChangedFiles(baseRef: string): string[] {
  return execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`, '--'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
}

/** Select the `ci:normal` jobs a diff can affect. */
export function getFocusJobs(changedFiles: readonly string[]): JobOrNoOpJob[] {
  const focused = selectFocusSandboxes(changedFiles);
  const siblings = selectChromaticSiblings(focused, changedFiles).map(defineSandboxFlow);

  return [
    build_linux,
    defineAffectedCheck(changedFiles),
    changedFiles.some(isGlobalInput) ? testsUnit_linux : defineAffectedUnitTests(changedFiles),
    defineAffectedLintAndFormat(changedFiles),
    ...selectPathTriggeredJobs(changedFiles),
    sandboxesNoOpJob,
    ...focused.flatMap((template) => defineSandboxFlow(template).jobs),
    ...siblings.flatMap(({ createJob, chromaticJob }) => [createJob, chromaticJob]),
  ];
}
