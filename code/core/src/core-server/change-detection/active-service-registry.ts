import type { StoryDependencyGraphService } from './StoryDependencyGraphService.ts';

let activeStoryDependencyGraphService: StoryDependencyGraphService | undefined;

/** @internal */
export function setDependencyGraphService(service: StoryDependencyGraphService | undefined): void {
  activeStoryDependencyGraphService = service;
}

/**
 * Returns the active graph service, or `undefined` if change detection is disabled, not yet
 * started, or disposed. Use {@link StoryDependencyGraphService.hasGraph} to check whether the
 * initial build has completed.
 *
 * @experimental
 */
export function getDependencyGraphService(): StoryDependencyGraphService | undefined {
  return activeStoryDependencyGraphService;
}
