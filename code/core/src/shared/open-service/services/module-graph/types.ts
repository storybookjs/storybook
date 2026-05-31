/**
 * Latest invalidation recorded by `core/module-graph`.
 *
 * `revision` is a monotonically increasing counter that lets subscribers detect a new invalidation
 * even when the affected component set is unchanged. `componentIds` is the set of component ids
 * whose source (story file or a transitively-imported module) changed in the last reported batch.
 */
export interface ModuleGraphInvalidation {
  revision: number;
  componentIds: string[];
}

export type ModuleGraphServiceState = {
  /** The most recent invalidation. `revision` starts at 0 with an empty component set. */
  lastAffected: ModuleGraphInvalidation;
};
