import type { executors } from './executors';
import { toId } from './helpers';
import type { parameters } from './parameters';

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
  steps: unknown[]; // Make this more type-strict, maybe
  parameters?: Record<string, unknown>;
  parallelism?: number;
};

export function defineJob<K extends string, I extends JobImplementation>(
  name: K,
  implementation: I,
  requires = [] as string[]
) {
  return {
    id: toId(name),
    name: name as string,
    implementation: {
      description: name,
      ...implementation,
    } as JobImplementation,
    requires,
  };
}

/**
 * A hub is a special type of job that is used to group other jobs together. It cannot contain any
 * steps/implementation.
 */
export function defineHub(name: string, requires = [] as string[]) {
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
