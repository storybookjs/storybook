import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  allTemplates,
  daily,
  docgenServerTemplates,
  type TemplateKey,
} from '../../code/lib/cli-storybook/src/sandbox-templates.ts';
import { isGlobalInput, isTestFixture } from './global-inputs.ts';
import {
  build_linux,
  defineAffectedCheck,
  defineAffectedLintAndFormat,
  defineAffectedUnitTests,
  fmt,
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

/**
 * Prerelease templates install upstream canaries, so they would fail PRs for upstream reasons.
 * Internal templates, such as the benchmarks, vary a public template for the nightly run.
 */
export const FOCUS_TEMPLATES = daily.filter(
  (key) => !key.includes('prerelease') && !allTemplates[key].isInternal
);

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
 * Select, for each changed package at the highest-priority role that matches, the first template in
 * cadence order that loads it. Chromatic siblings cover the other templates loading it.
 */
export function selectFocusSandboxes(changedFiles: readonly string[]): TemplateKey[] {
  for (const role of ROLES) {
    const changedDirs = new Set(
      FOCUS_TEMPLATES.flatMap((key) => templateDirs(key)[role]).filter((dir) =>
        isChanged([dir], changedFiles)
      )
    );

    if (changedDirs.size > 0) {
      return [
        ...new Set(
          [...changedDirs].map((dir) =>
            FOCUS_TEMPLATES.find((key) => templateDirs(key)[role].includes(dir))!
          )
        ),
      ];
    }
  }

  return [DEFAULT_FOCUS_SANDBOX];
}

/** Every sandbox that runs Chromatic links the core and addon template stories. */
const isSharedTemplateFile = (file: string) => /^code\/(core|addons\/[^/]+)\/template\//.test(file);

/** Select the other templates that run Chromatic and load a changed package or shared story. */
export function selectChromaticSiblings(
  focused: readonly TemplateKey[],
  changedFiles: readonly string[]
): TemplateKey[] {
  const sharedTemplateChanged = changedFiles.some(isSharedTemplateFile);

  return FOCUS_TEMPLATES.filter(
    (sibling) =>
      !focused.includes(sibling) &&
      !allTemplates[sibling].skipTasks?.includes('chromatic') &&
      (sharedTemplateChanged ||
        isChanged(Object.values(templateDirs(sibling)).flat(), changedFiles))
  );
}

const DOCGEN_SHARED_PATHS = [
  'code/core/src/component-meta/',
  'code/core/src/csf-tools/',
  'code/core/src/docs-tools/argTypes/',
  'code/core/src/common/utils/component-id.ts',
  'code/core/src/common/utils/component-path-from-story.ts',
  'code/core/src/common/utils/resolve-meta-component.ts',
  'code/core/src/common/utils/select-component-entry.ts',
  'code/core/src/common/utils/subcomponents.ts',
  'code/core/src/shared/open-service/',
  'code/lib/docgen-harness/src/sandbox-baselines/',
];

/**
 * Select the docgen server templates whose baselines the diff can move and that no other focus job
 * creates. A sandbox verifies its docgen baselines when it is created, and the only React one is an
 * internal template, which neither the focused nor the sibling selection ever picks.
 */
export function selectDocgenBaselineSandboxes(
  created: readonly TemplateKey[],
  changedFiles: readonly string[]
): TemplateKey[] {
  const sharedDocgenChanged = isChanged(DOCGEN_SHARED_PATHS, changedFiles);

  return docgenServerTemplates().filter(
    (key) =>
      daily.includes(key) &&
      !key.includes('prerelease') &&
      !created.includes(key) &&
      (sharedDocgenChanged || isChanged(Object.values(templateDirs(key)).flat(), changedFiles))
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
export const PATH_TRIGGERED_JOBS: readonly {
  job: JobOrNoOpJob;
  paths: readonly string[];
}[] = [
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
    // Its e2e tests also cover the test-run tool of addon-vitest, with a real Vitest.
    paths: ['code/addons/mcp/', 'code/lib/mcp/', 'code/addons/vitest/', 'test-storybooks/mcp/'],
  },
  { job: internalStorybookE2e, paths: INTERNAL_STORYBOOK_PATHS },
  { job: internalStorybookBuildE2e, paths: INTERNAL_STORYBOOK_PATHS },
  { job: testsStories_linux, paths: INTERNAL_STORYBOOK_PATHS },
  { job: fmt, paths: ['docs/', 'scripts/docs/'] },
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
  const focused = selectFocusSandboxes(changedFiles);
  const siblingKeys = selectChromaticSiblings(focused, changedFiles);
  const siblings = siblingKeys.map(defineSandboxFlow);
  const docgenSandboxes = selectDocgenBaselineSandboxes(
    [...focused, ...siblingKeys],
    changedFiles
  ).map(defineSandboxFlow);

  return [
    build_linux,
    defineAffectedCheck(changedFiles),
    changedFiles.some((file) => isGlobalInput(file) || isTestFixture(file))
      ? testsUnit_linux
      : defineAffectedUnitTests(changedFiles),
    defineAffectedLintAndFormat(changedFiles),
    // The internal Storybook loads stories from across `code`, and TurboSnap snapshots only those the diff affects.
    storybookChromatic,
    ...selectPathTriggeredJobs(changedFiles),
    sandboxesNoOpJob,
    ...focused.flatMap((template) => defineSandboxFlow(template).jobs),
    ...siblings.flatMap(({ createJob, chromaticJob }) => [createJob, chromaticJob]),
    ...docgenSandboxes.map(({ createJob }) => createJob),
  ];
}
