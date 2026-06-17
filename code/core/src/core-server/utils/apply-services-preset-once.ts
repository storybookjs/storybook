import type { Presets } from 'storybook/internal/types';

declare global {
  // eslint-disable-next-line no-var
  var STORYBOOK_SERVICES_PRESET_PROMISE: Promise<void> | undefined;
}

globalThis.STORYBOOK_SERVICES_PRESET_PROMISE = undefined;

/**
 * Applies the 'services' preset, but only once, as the services must not be registered multiple times.
 *
 * This is to ensure that we don't apply the preset multiple times in dev mode, which can lead to issues with the telemetry service and other services that are meant to be singletons.
 */
export async function applyServicesPresetOnce(presets: Presets): Promise<void> {
  return (globalThis.STORYBOOK_SERVICES_PRESET_PROMISE ??= presets.apply('services'));
}
