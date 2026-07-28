/**
 * The scenario plumbing both Vue engine harnesses share: option parsing, project generation, the
 * measured component set, and the per-save mutation.
 *
 * The two engines must see byte-identical projects and touch the same files in the same order, or
 * the ratio between their medians measures the generator instead of the engines. Keeping the shared
 * half here is what makes that true by construction.
 *
 * Scenarios:
 *   flat             single package; the measured set is every component.
 *   workspace        packages/* layout; the measured set is the deepest package's components, whose
 *                    prop types pull the whole cross-package chain.
 *   base-type-touch  workspace layout, but every save touches the widely-imported base type instead
 *                    of a component, so each sample pays a wide invalidation.
 */
import * as path from 'node:path';

import { Args } from '../../docgen-shared/args.ts';
import { SANDBOX_DIRECTORY } from '../../docgen-shared/paths.ts';
import {
  type GeneratedVueProject,
  baseTypesSource,
  generateVueProject,
  vueComponentSource,
} from '../generators/vue.ts';

export const VUE_SCENARIOS = ['flat', 'workspace', 'base-type-touch'] as const;
export type VueScenario = (typeof VUE_SCENARIOS)[number];

export interface VueHarnessOptions {
  scenario: VueScenario;
  packages: number;
  componentsPerPackage: number;
  chainDepth: number;
  fanOut: number;
  heavyLib: boolean;
  saves: number;
  outDir: string;
  jsonOut?: string;
}

export function parseVueOptions(argv: string[], engineDirName: string): VueHarnessOptions {
  const args = new Args(argv);
  return {
    scenario: args.choice('scenario', VUE_SCENARIOS, 'workspace'),
    packages: args.count('packages', 4),
    componentsPerPackage: args.count('components-per-package', 10),
    chainDepth: args.count('chain-depth', 3),
    fanOut: args.count('fan-out', 4),
    heavyLib: args.flag('heavy-lib'),
    saves: args.count('saves', 15),
    outDir: args.string('out', path.join(SANDBOX_DIRECTORY, 'docgen-perf', engineDirName, 'project')),
    jsonOut: args.optional('json'),
  };
}

export function vueBanner(options: VueHarnessOptions): Record<string, unknown> {
  return {
    packages: effectivePackages(options),
    componentsPerPackage: options.componentsPerPackage,
    chainDepth: options.chainDepth,
    fanOut: options.fanOut,
    heavyLib: options.heavyLib,
    saves: options.saves,
  };
}

/** The `flat` scenario is a single-package layout whatever `--packages` says. */
export function effectivePackages(options: VueHarnessOptions): number {
  return options.scenario === 'flat' ? 1 : options.packages;
}

/** One save's disk mutation: which file changes, and what it becomes. */
export interface VueSaveMutation {
  filePath: string;
  content: string;
  /** The component to re-extract afterwards. */
  measuredPath: string;
}

export interface VueScenarioSetup {
  project: GeneratedVueProject;
  /** The components the cold pass extracts, and the saves rotate through. */
  targetPaths: string[];
  targetPackage: number;
  /** The disk mutation for save `save`. Deterministic, so both engines apply the same one. */
  mutationFor(save: number): VueSaveMutation;
}

export function setUpVueScenario(options: VueHarnessOptions): VueScenarioSetup {
  const packages = effectivePackages(options);

  const genStart = Date.now();
  const project = generateVueProject({
    outDir: options.outDir,
    packages,
    componentsPerPackage: options.componentsPerPackage,
    chainDepth: options.chainDepth,
    fanOut: options.fanOut,
    heavyLib: options.heavyLib,
  });
  console.log(`  generated project in ${Date.now() - genStart}ms at ${project.outDir}`);

  const targetPackage = packages - 1;
  const targetPaths =
    options.scenario === 'flat'
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
        // Touch the widely-imported base type; every dependent package's props type changes. The
        // re-extraction target is fixed so each sample pays the same wide invalidation.
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
        content: vueComponentSource(targetPackage, t, extraByTarget[t]),
        measuredPath: targetPaths[t],
      };
    },
  };
}
