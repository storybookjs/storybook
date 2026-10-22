import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

import { join } from 'pathe';

import {
  allTemplates,
  daily,
  type TemplateKey,
} from '../../code/lib/cli-storybook/src/sandbox-templates.ts';
import { isGlobalInput, isTestFixture } from './global-inputs.ts';
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

/** Prerelease templates install upstream canaries, so they would fail PRs for upstream reasons. */
export const FOCUS_TEMPLATES = daily.filter((key) => !key.includes('prerelease'));

const ROOT = join(import.meta.dirname, '../..');

export const packageDirs = new Map(
  ['code/frameworks', 'code/renderers', 'code/builders', 'code/lib', 'code/presets'].flatMap(
    (root) =>
      readdirSync(join(ROOT, root))
        .filter((dir) => existsSync(join(ROOT, root, dir, 'package.json')))
        .map((dir) => {
          const {
            name,
            dependencies = {},
            devDependencies = {},
          } = JSON.parse(readFileSync(join(ROOT, root, dir, 'package.json'), 'utf8'));
          // Packages bundle some workspace libraries from their devDependencies.
          return [
            name as string,
            {
              dir: `${root}/${dir}/`,
              dependencies: [...Object.keys(dependencies), ...Object.keys(devDependencies)],
            },
          ];
        })
  )
);

/** Ordered by priority: a framework match picks the sandboxes before a renderer match, and so on. */
const ROLES = ['framework', 'renderer', 'builder', 'dependency'] as const;

type Role = (typeof ROLES)[number];

/** The workspace directories a template's sandbox loads, by the role they play in it. */
export function templateDirs(key: TemplateKey): Record<Role, string[]> {
  const { framework, renderer, builder } = allTemplates[key].expected;
  const dirsOf = (names: string[]) => names.flatMap((name) => packageDirs.get(name)?.dir ?? []);
  const dependencies = [framework, renderer, builder].flatMap(
    (name) => packageDirs.get(name)?.dependencies ?? []
  );

  return {
    framework: dirsOf([framework]),
    renderer: dirsOf([renderer]),
    builder: dirsOf([builder]),
    dependency: dirsOf(dependencies).filter((dir) => /^code\/(lib|presets)\//.test(dir)),
  };
}

const isChanged = (dirs: readonly string[], changedFiles: readonly string[]) =>
  dirs.some((dir) => changedFiles.some((file) => file.startsWith(dir)));

/**
 * Select the first public template in cadence order that loads a changed package, at the
 * highest-priority role that matches. Chromatic siblings cover the other templates loading it.
 */
export function selectFocusSandbox(changedFiles: readonly string[]): TemplateKey {
  for (const role of ROLES) {
    const sandbox = FOCUS_TEMPLATES.find(
      (key) => !allTemplates[key].isInternal && isChanged(templateDirs(key)[role], changedFiles)
    );

    if (sandbox) {
      return sandbox;
    }
  }

  return DEFAULT_FOCUS_SANDBOX;
}

/** Select the other templates that run Chromatic and load a changed package. */
export function selectChromaticSiblings(
  focused: TemplateKey,
  changedFiles: readonly string[]
): TemplateKey[] {
  return FOCUS_TEMPLATES.filter(
    (sibling) =>
      sibling !== focused &&
      !allTemplates[sibling].skipTasks?.includes('chromatic') &&
      isChanged(Object.values(templateDirs(sibling)).flat(), changedFiles)
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

const portableStoryTest = (directory: string, sourcePaths: readonly string[]) => ({
  job: definePortableStoryTest(directory),
  paths: [
    ...sourcePaths,
    'code/core/src/preview-api/',
    'code/core/src/csf/',
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
  portableStoryTest('react', ['code/renderers/react/', 'code/addons/vitest/']),
  portableStoryTest('vue3', ['code/renderers/vue3/']),
  portableStoryTest('svelte', ['code/renderers/svelte/']),
  portableStoryTest('nextjs', ['code/frameworks/nextjs/']),
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

/** Select the jobs a diff can affect. */
export function getFocusJobs(changedFiles: readonly string[]): JobOrNoOpJob[] {
  const focused = selectFocusSandbox(changedFiles);
  const siblings = selectChromaticSiblings(focused, changedFiles).map(defineSandboxFlow);

  return [
    build_linux,
    defineAffectedCheck(changedFiles),
    changedFiles.some((file) => isGlobalInput(file) || isTestFixture(file))
      ? testsUnit_linux
      : defineAffectedUnitTests(changedFiles),
    defineAffectedLintAndFormat(changedFiles),
    ...selectPathTriggeredJobs(changedFiles),
    sandboxesNoOpJob,
    ...defineSandboxFlow(focused).jobs,
    ...siblings.flatMap(({ createJob, chromaticJob }) => [createJob, chromaticJob]),
  ];
}
