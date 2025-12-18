import type { executors } from './executors';
import { toId } from './helpers';
import type { parameters } from './parameters';

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
  steps: unknown[];
  parameters?: Record<string, unknown>;
  parallelism?: number;
};

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
  }
}
