import type { executors } from './executors';
import { toId } from './helpers';

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
