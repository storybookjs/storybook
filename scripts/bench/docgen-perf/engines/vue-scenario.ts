/**
 * The scenario plumbing both Vue engine harnesses share: option parsing, project generation, the
 * measured component set, and the per-save mutation. Both engines must see identical projects and
 * touch the same files in the same order, or the ratio between their medians measures the generator
 * instead of the engines.
 *
 * Scenarios:
 *   flat             single package; the measured set is every component.
 *   workspace        packages/* layout; the measured set is the deepest package's components, whose
 *                    prop types pull the whole cross-package chain.
 *   base-type-touch  workspace layout, but every save touches the widely-imported base type instead
 *                    of a component, so each sample pays a wide invalidation.
 */
import * as path from 'node:path';

import { z } from 'zod';

import { countOption, parseHarnessOptions } from '../../docgen-shared/args.ts';
import { SANDBOX_DIRECTORY } from '../../docgen-shared/paths.ts';
import {
  type GeneratedVueProject,
  baseTypesSource,
  generateVueProject,
  vueComponentSource,
} from '../generators/vue.ts';

export const VUE_SCENARIOS = ['flat', 'workspace', 'base-type-touch'] as const;

const OPTIONS = {
  scenario: { type: 'string' },
  packages: { type: 'string' },
  'components-per-package': { type: 'string' },
  'chain-depth': { type: 'string' },
  'fan-out': { type: 'string' },
  'heavy-lib': { type: 'boolean' },
  saves: { type: 'string' },
  out: { type: 'string' },
  json: { type: 'string' },
} as const;

/** `engineDirName` only supplies the default scratch directory, so it is bound per harness. */
const schemaFor = (engineDirName: string) =>
  z.object({
    scenario: z.enum(VUE_SCENARIOS).default('workspace'),
    packages: countOption(4),
    componentsPerPackage: countOption(10),
    chainDepth: countOption(3),
    fanOut: countOption(4),
    heavyLib: z.boolean().default(false),
    saves: countOption(15),
    outDir: z
      .string()
      .default(path.join(SANDBOX_DIRECTORY, 'docgen-perf', engineDirName, 'project')),
    jsonOut: z.string().optional(),
  });

export type VueHarnessOptions = z.infer<ReturnType<typeof schemaFor>>;

export function parseVueOptions(argv: string[], engineDirName: string): VueHarnessOptions {
  return parseHarnessOptions<VueHarnessOptions>(argv, OPTIONS, schemaFor(engineDirName), (values) => ({
    ...values,
    outDir: values.out,
    jsonOut: values.json,
  }));
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
