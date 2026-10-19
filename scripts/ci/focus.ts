import { execFileSync } from 'node:child_process';

import {
  allTemplates,
  type FocusPathKind,
  normal,
  type Template,
  type TemplateKey,
} from '../../code/lib/cli-storybook/src/sandbox-templates.ts';
import { build_linux, testsUnit_linux } from './common-jobs.ts';
import { defineSandboxFlow, sandboxesNoOpJob } from './sandboxes.ts';
import type { JobOrNoOpJob } from './utils/types.ts';

const DEFAULT_FOCUS_SANDBOX = 'react-vite/default-ts' satisfies TemplateKey;

const FOCUS_PATH_PRIORITY = [
  'framework',
  'renderer',
  'builder',
] as const satisfies readonly FocusPathKind[];

export function selectFocusSandbox(changedFiles: readonly string[]): TemplateKey {
  for (const kind of FOCUS_PATH_PRIORITY) {
    const sandbox = (Object.entries(allTemplates) as [TemplateKey, Template][]).find(
      ([, { focusPathPrefixes }]) => {
        const prefix = focusPathPrefixes?.[kind];

        return prefix !== undefined && changedFiles.some((file) => file.startsWith(prefix));
      }
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
      .filter(({ focusPathPrefixes }) => {
        const prefix = focusPathPrefixes?.renderer;

        return prefix !== undefined && changedFiles.some((file) => file.startsWith(prefix));
      })
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
 * Select the `ci:normal` jobs a diff needs: the build, unit tests, every job of the focused
 * sandbox, and a Chromatic run for each sibling whose renderer changed.
 */
export function getFocusJobs(changedFiles: readonly string[]): JobOrNoOpJob[] {
  const template = selectFocusSandbox(changedFiles);
  const siblings = selectChromaticSiblings(template, changedFiles).map(defineSandboxFlow);

  return [
    build_linux,
    testsUnit_linux,
    sandboxesNoOpJob,
    ...defineSandboxFlow(template).jobs,
    ...siblings.flatMap(({ createJob, chromaticJob }) =>
      chromaticJob ? [createJob, chromaticJob] : []
    ),
  ];
}
