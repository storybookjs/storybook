// The scenario plumbing every workspace-project harness shares (the Vue and Svelte engines): option
// parsing, project generation, the measured component set, and the per-save mutation. Two engines
// must see identical projects and touch the same files in the same order, or the ratio between their
// medians measures the generator instead of the engines.
//
// Scenarios:
//   flat             single package; the measured set is every component.
//   large-program    flat, over a program of thousands of files, most of them dependency
//                    declarations, as in a real app. An engine whose per-request cost grows with the
//                    program's file count shows it here and nowhere else.
//   workspace        packages/* layout; the measured set is the deepest package's components, whose
//                    prop types pull the whole cross-package chain.
//   base-type-touch  workspace layout, but every save touches the widely-imported base type instead
//                    of a component, so each sample pays a wide invalidation.
import * as path from 'pathe';

import { z } from 'zod';

import { countOption, parseHarnessOptions } from '../../docgen-shared/args.ts';
import { SANDBOX_DIRECTORY } from '../../docgen-shared/paths.ts';
import {
  type GeneratedWorkspaceProject,
  type WorkspaceFramework,
  baseTypesSource,
} from '../generators/workspace.ts';

export const WORKSPACE_SCENARIOS = [
  'flat',
  'workspace',
  'base-type-touch',
  'large-program',
] as const;

// The flags every workspace harness accepts. A harness with a flag of its own spreads this and extends
// {@link WORKSPACE_SCHEMA}, so every flag still reaches one strict parser and one schema.
export const WORKSPACE_OPTIONS = {
  scenario: { type: 'string' },
  packages: { type: 'string' },
  'components-per-package': { type: 'string' },
  'chain-depth': { type: 'string' },
  'fan-out': { type: 'string' },
  'heavy-lib': { type: 'boolean' },
  'lib-modules': { type: 'string' },
  saves: { type: 'string' },
  out: { type: 'string' },
  json: { type: 'string' },
} as const;

export const WORKSPACE_SCHEMA = z.object({
  scenario: z.enum(WORKSPACE_SCENARIOS).default('workspace'),
  packages: countOption(4),
  componentsPerPackage: countOption(10),
  chainDepth: countOption(3),
  fanOut: countOption(4),
  heavyLib: z.boolean().default(false),
  libModules: countOption(0),
  saves: countOption(15),
  // Resolved after parsing, because a harness can only know which scratch directory it defaults to
  // once its own flags are parsed - the pinned vue-component-meta install being the case in point.
  outDir: z.string().optional(),
  jsonOut: z.string().optional(),
});

// parseArgs keys these as written; the schema names them as the harnesses read them.
export const workspaceToInput = (values: Record<string, unknown>) => ({
  ...values,
  outDir: values.out,
  jsonOut: values.json,
});

// Where a harness generates its project when `--out` was not given.
export const workspaceOutDir = (engineDirName: string): string =>
  path.join(SANDBOX_DIRECTORY, 'docgen-perf', engineDirName, 'project');

// Straight off the shared flags, before a harness has resolved its scratch directory.
export type WorkspaceOptionsInput = z.infer<typeof WORKSPACE_SCHEMA>;

export type WorkspaceHarnessOptions = WorkspaceOptionsInput & { outDir: string };

export function parseWorkspaceOptions(
  argv: string[],
  engineDirName: string
): WorkspaceHarnessOptions {
  const parsed = parseHarnessOptions<WorkspaceOptionsInput>(
    argv,
    WORKSPACE_OPTIONS,
    WORKSPACE_SCHEMA,
    workspaceToInput
  );
  return { ...parsed, outDir: parsed.outDir ?? workspaceOutDir(engineDirName) };
}

export function workspaceBanner(options: WorkspaceHarnessOptions): Record<string, unknown> {
  return {
    packages: effectivePackages(options),
    componentsPerPackage: options.componentsPerPackage,
    chainDepth: options.chainDepth,
    fanOut: options.fanOut,
    heavyLib: options.heavyLib,
    libModules: options.libModules,
    saves: options.saves,
  };
}

const isFlat = (options: WorkspaceHarnessOptions) =>
  options.scenario === 'flat' || options.scenario === 'large-program';

// The flat scenarios are a single-package layout whatever `--packages` says.
export function effectivePackages(options: WorkspaceHarnessOptions): number {
  return isFlat(options) ? 1 : options.packages;
}

// One save's disk mutation: which file changes, and what it becomes.
export interface SaveMutation {
  filePath: string;
  content: string;
  // The component to re-extract afterwards.
  measuredPath: string;
}

export interface WorkspaceScenarioSetup {
  project: GeneratedWorkspaceProject;
  // The components the cold pass extracts, and the saves rotate through.
  targetPaths: string[];
  targetPackage: number;
  // The disk mutation for save `save`. Deterministic, so both engines apply the same one.
  mutationFor(save: number): SaveMutation;
}

export function setUpWorkspaceScenario(
  options: WorkspaceHarnessOptions,
  framework: WorkspaceFramework
): WorkspaceScenarioSetup {
  const packages = effectivePackages(options);

  const genStart = Date.now();
  const project = framework.generate({
    outDir: options.outDir,
    packages,
    componentsPerPackage: options.componentsPerPackage,
    chainDepth: options.chainDepth,
    fanOut: options.fanOut,
    heavyLib: options.heavyLib,
    libModules: options.libModules,
  });
  console.log(`  generated project in ${Date.now() - genStart}ms at ${project.outDir}`);

  const targetPackage = packages - 1;
  const targetPaths = isFlat(options)
    ? project.componentPaths
    : project.componentPaths.slice(-options.componentsPerPackage);

  const extraByTarget = new Array<number>(targetPaths.length).fill(0);
  let extraBaseProps = 0;

  return {
    project,
    targetPaths,
    targetPackage,
    mutationFor(save) {
      if (options.scenario === 'base-type-touch') {
        extraBaseProps += 1;
        return {
          filePath: project.baseTypesPath,
          content: baseTypesSource(options.fanOut, extraBaseProps),
          measuredPath: targetPaths[0],
        };
      }
      const t = (save - 1) % targetPaths.length;
      extraByTarget[t] += 1;
      return {
        filePath: targetPaths[t],
        content: framework.componentSource(targetPackage, t, extraByTarget[t]),
        measuredPath: targetPaths[t],
      };
    },
  };
}
