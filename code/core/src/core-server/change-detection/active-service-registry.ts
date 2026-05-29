import type { ChangeDetectionService } from './ChangeDetectionService.ts';

let activeService: ChangeDetectionService | undefined;

/**
 * Records the change-detection service started by the current Storybook dev server
 * so that in-process consumers (addon presets) can reach it without going through a
 * preset hook. Dev server is single-instance, so only one service is ever active.
 *
 * @internal
 */
export function setActiveChangeDetectionService(service: ChangeDetectionService | undefined): void {
  activeService = service;
}

/**
 * Returns the change-detection service for the current dev-server process, or
 * `undefined` when change detection is disabled / not yet started / disposed.
 *
 * Read at request time, not at preset load time — the service is constructed
 * after presets register.
 *
 * @experimental
 */
export function getActiveChangeDetectionService(): ChangeDetectionService | undefined {
  return activeService;
}
