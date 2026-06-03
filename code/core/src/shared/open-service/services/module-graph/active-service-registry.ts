import type { ModuleGraphEngine } from './engine/ModuleGraphEngine.ts';

let activeModuleGraphEngine: ModuleGraphEngine | undefined;

/** @internal */
export function setDependencyGraphService(service: ModuleGraphEngine | undefined): void {
  activeModuleGraphEngine = service;
}

/**
 * Returns the active module graph engine registered by {@link registerModuleGraphService}, or
 * `undefined` when the dev-server has not finished booting yet or has already torn down.
 *
 * @experimental
 */
export function getDependencyGraphService(): ModuleGraphEngine | undefined {
  return activeModuleGraphEngine;
}

/** @deprecated Use {@link ModuleGraphEngine} — kept for transitional typing in external consumers. */
export type StoryDependencyGraphService = ModuleGraphEngine;
