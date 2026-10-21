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
  defineAffectedUnitTests,
  testsUnit_linux,
} from './common-jobs.ts';
import { defineSandboxFlow, sandboxesNoOpJob } from './sandboxes.ts';
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

export function selectFocusSandbox(changedFiles: readonly string[]): TemplateKey {
  for (const root of FOCUS_PATH_ROOTS) {
    const sandbox = (Object.entries(allTemplates) as [TemplateKey, Template][]).find(
      ([, template]) => isChangedUnder(template, root, changedFiles)
    )?.[0];

    if (sandbox) {
      return sandbox;
    }
  }

  return DEFAULT_FOCUS_SANDBOX;
}

/** Select the PR-workflow templates whose renderer source changed. */
export function selectChromaticSiblings(
  template: TemplateKey,
  changedFiles: readonly string[]
): TemplateKey[] {
  const changedRenderers = new Set(
    Object.values(allTemplates)
      .filter((candidate) => isChangedUnder(candidate, 'code/renderers/', changedFiles))
      .map(({ expected }) => expected.renderer)
  );

  return normal.filter(
    (sibling) =>
      sibling !== template && changedRenderers.has(allTemplates[sibling].expected.renderer)
  );
}

export function getChangedFiles(baseRef: string): string[] {
  return execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`, '--'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
}

/**
 * Select the `ci:normal` jobs a diff needs: the build, the typecheck and unit tests affected by the
 * diff (the full unit suite when a global input changed), every job of the focused sandbox, and a
 * Chromatic run for each sibling whose renderer changed.
 */
export function getFocusJobs(changedFiles: readonly string[]): JobOrNoOpJob[] {
  const template = selectFocusSandbox(changedFiles);
  const siblings = selectChromaticSiblings(template, changedFiles).map(defineSandboxFlow);

  return [
    build_linux,
    defineAffectedCheck(changedFiles),
    changedFiles.some(isGlobalInput) ? testsUnit_linux : defineAffectedUnitTests(changedFiles),
    sandboxesNoOpJob,
    ...defineSandboxFlow(template).jobs,
    ...siblings.flatMap(({ createJob, chromaticJob }) =>
      chromaticJob ? [createJob, chromaticJob] : []
    ),
  ];
}
