import type { executors } from './executors.ts';
import { toId } from './helpers.ts';

export type Job<K extends string> = {
  id: string;
  name: K;
  implementation: (workflow: Workflow) => JobImplementationObj | NoOpJobImplementationObj;
  requires: JobOrNoOpJob[];
};

export type JobOrNoOpJob = Job<string>;

export type NoOpJobImplementationObj = {
  type: 'no-op';
};

export type NoOpJobImplementation = (workflow: Workflow) => NoOpJobImplementationObj;

export type JobImplementationObj = {
  executor:
    | {
        name: keyof typeof executors;
        class: 'small' | 'medium' | 'medium+' | 'large' | 'xlarge';
      }
    | {
        name: 'win/default';
        size: 'small' | 'medium' | 'medium+' | 'large' | 'xlarge';
      };
  /**
   * The steps to run in the job.
   *
   * @example
   *
   * ```ts
   * {
   *   run: {
   *     name: string,
   *     working_directory: string,
   *     command: string,
   *     background: boolean,
   *     shell: string,
   *     env: Record<string, string>,
   *   },
   * }
   * ```
   *
   * @see https://circleci.com/docs/guides/orchestrate/jobs-steps/#steps-overview
   * @todo Make this more type-strict, maybe with a union type of step objects. See the example
   *   above.
   */
  steps: unknown[];

  /** I think we generally want to avoid this, since we're generating the jobs dynamically. */
  parameters?: Record<string, unknown>;

  /**
   * We don't use this today, but it's available for future use. We might want to use it when
   * running many many unit tests in parallel.
   */
  parallelism?: number;
};

export type JobImplementation = (workflow: Workflow) => JobImplementationObj;

/**
 * This function ensures the jobs adhere to the expected interface and that the job's ID is valid.
 * (i.e. no special characters, no spaces, etc.) Thus the ID can be referenced by other jobs in the
 * `requires` field.
 *
 * @param name - The name of the job
 * @param implementation - The implementation of the job
 * @param requires - The jobs that this job depends on
 * @returns The job's id, name, implementation, requires
 */
export function defineJob<K extends string, I extends JobImplementation>(
  name: K,
  implementation: I,
  requires = [] as JobOrNoOpJob[]
): Job<K> {
  return {
    id: toId(name),
    name: name,
    implementation: (workflow) => ({
      description: name,
      ...implementation(workflow),
    }),
    requires,
  };
}

/**
 * A NoOpJob is a special type of job that is used to group other jobs together. It cannot contain
 * any steps/implementation.
 *
 * @param name - The name of the NoOpJob
 * @param requires - The jobs that this NoOpJob depends on
 */
export function defineNoOpJob<K extends string>(name: K, requires = [] as JobOrNoOpJob[]): Job<K> {
  return {
    id: toId(name),
    name,
    implementation: () =>
      ({
        type: 'no-op',
      }) as const,
    requires,
  };
}

/**
 * The statically-known workflows. `normal`, `merged` and `daily` are the cadence workflows with
 * increasing sandbox coverage. `docs` only checks formatting. `core` runs everything `normal` runs
 * except the sandbox jobs.
 *
 * Besides these, a workflow can be a sandbox-split atom derived at runtime from the sandbox
 * template metadata: a framework (e.g. `react`, `vue3`, `angular`) or a builder (e.g. `vite`,
 * `webpack`). See `getSandboxSplitAtoms` in `../sandboxes.ts`. Multiple atoms are combined with
 * `+` in the CircleCI `workflow` pipeline parameter (e.g. `core+react`) and validated in
 * `../main.ts`.
 */
export const STATIC_WORKFLOWS = ['normal', 'merged', 'daily', 'skipped', 'docs', 'core'] as const;

export type Workflow = (typeof STATIC_WORKFLOWS)[number] | (string & {});

/**
 * Checks if the current workflow is at least the minimum workflow.
 *
 * `normal` → `merged` → `daily`
 *
 * `core` is `normal` minus the sandbox jobs, so it counts as `normal`-level for everything that
 * keys off `normal` (the sandbox list itself is resolved separately and is empty for `core`).
 *
 * `docs` is unique, in that it's not considered below of above anything. Sandbox-split atoms
 * (frameworks/builders) are never "at or above" any cadence workflow.
 *
 * @example
 *
 * ```ts
 * isWorkflowOrAbove('normal', 'normal'); // true
 * isWorkflowOrAbove('normal', 'merged'); // false
 * isWorkflowOrAbove('normal', 'daily'); // false
 * isWorkflowOrAbove('daily', 'normal'); // true
 * ```
 *
 * @param current - The current workflow
 * @param minimum - The minimum workflow
 * @returns True if the current workflow is at least the minimum workflow, false otherwise
 */
export function isWorkflowOrAbove(current: Workflow, minimum: Workflow): boolean {
  switch (current) {
    case 'core':
      return minimum === 'normal' || minimum === 'core';
    case 'normal':
      return minimum === 'normal';
    case 'merged':
      return minimum === 'normal' || minimum === 'merged';
    case 'daily':
      return minimum === 'normal' || minimum === 'merged' || minimum === 'daily';
    case 'docs':
      return minimum === 'docs';
    default:
      return false;
  }
}
