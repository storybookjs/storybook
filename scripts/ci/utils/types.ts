import type { executors } from './executors';
import { toId } from './helpers';
import type { parameters } from './parameters';

export type Job<K extends string, I extends JobImplementation | HubImplementation> = {
  id: string;
  name: K;
  implementation: I;
  requires: JobsOrHub[];
};

export type Hub<K extends string> = Job<K, HubImplementation>;

export type JobsOrHub = Job<string, JobImplementation | HubImplementation>;

export type HubImplementation = {
  type: 'no-op';
};

export type JobImplementation = {
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
  requires = [] as JobsOrHub[]
): Job<K, I> {
  return {
    id: toId(name),
    name: name,
    implementation: {
      description: name,
      ...implementation,
    } satisfies JobImplementation,
    requires,
  };
}

/**
 * A hub is a special type of job that is used to group other jobs together. It cannot contain any
 * steps/implementation.
 *
 * @param name - The name of the hub
 * @param requires - The jobs that this hub depends on
 */
export function defineHub<K extends string>(name: K, requires = [] as JobsOrHub[]): Hub<K> {
  return {
    id: toId(name),
    name,
    implementation: {
      type: 'no-op',
    } as const,
    requires,
  };
}

export type Workflow = (typeof parameters.workflow.enum)[number];

/**
 * Checks if the current workflow is at least the minimum workflow.
 *
 * `docs` → `normal` → `merged` → `daily`
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
