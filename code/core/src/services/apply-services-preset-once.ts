import './hooks.ts';

import type { Presets } from '@storybook/core/internal/types';

import { getInstanceContext } from '../shared/instance-context.ts';

const SERVICES_PRESET = Symbol.for('storybook.instance.services-preset');

/** Applies the `services` preset once per instance, as services must not register twice. */
export async function applyServicesPresetOnce(presets: Presets): Promise<void> {
  const context = getInstanceContext();
  if (!context) {
    throw new Error('Services can only be applied inside a Storybook instance.');
  }
  if (!context.state.has(SERVICES_PRESET)) {
    context.state.set(
      SERVICES_PRESET,
      context.storybook
        ? context.storybook.callHook('core:services:register', undefined)
        : presets.apply('services')
    );
  }
  return context.state.get(SERVICES_PRESET) as Promise<void>;
}

/** Clears the one-shot so a later configuration load can apply the `services` preset again. */
export function resetServicesPresetOnce(): void {
  getInstanceContext()?.state.delete(SERVICES_PRESET);
}
