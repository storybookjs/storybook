import type { StoryDependencyGraphService } from './StoryDependencyGraphService.ts';

let activeStoryDependencyGraphService: StoryDependencyGraphService | undefined;

/** @internal */
export function setDependencyGraphService(service: StoryDependencyGraphService | undefined): void {
  activeStoryDependencyGraphService = service;
}

/**
 * Returns the active graph service registered by the dev-server lifecycle, or `undefined` when
 * the dev-server has not finished booting yet or has already torn down. The service may exist even
 * when change-detection statuses are disabled. Use {@link StoryDependencyGraphService.hasGraph} to
 * check whether the initial build has completed.
 *
 * @experimental
 */
export function getDependencyGraphService(): StoryDependencyGraphService | undefined {
  return activeStoryDependencyGraphService;
}
