import type { ReverseIndex } from './engine/dependency-graph/types.ts';

/** JSON-serializable reverse index shape stored in open-service state. */
export type StoriesByFileRecord = Record<string, Record<string, number>>;

export type ModuleGraphServiceState = {
  ready: boolean;
  graphRevision: number;
  storiesByFile: StoriesByFileRecord;
  storyVersions: Record<string, number>;
};

export function reverseIndexToStoriesByFile(index: ReverseIndex): StoriesByFileRecord {
  const result: StoriesByFileRecord = {};
  for (const [dep, stories] of index) {
    result[dep] = Object.fromEntries(stories);
  }
  return result;
}

export type GraphUpdatePayload = {
  storiesByFile: StoriesByFileRecord;
  bumpedStoryFiles: string[];
};
