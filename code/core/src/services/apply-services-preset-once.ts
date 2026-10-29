import './hooks.ts';

import type { Storybook } from '../instance/types.ts';
import { getInstanceContext } from '../shared/instance-context.ts';

const SERVICES_PRESET = Symbol.for('storybook.instance.services-preset');

/** Registers the instance's services once, as services must not register twice. */
export async function applyServicesPresetOnce(
  storybook: Pick<Storybook, 'callHook'>
): Promise<void> {
  const context = getInstanceContext();
  if (!context) {
    throw new Error('Services can only be applied inside a Storybook instance.');
  }
  if (!context.state.has(SERVICES_PRESET)) {
    context.state.set(SERVICES_PRESET, storybook.callHook('core:services:register', undefined));
  }
  return context.state.get(SERVICES_PRESET) as Promise<void>;
}

/** Clears the one-shot so a later configuration load can register services again. */
export function resetServicesPresetOnce(): void {
  getInstanceContext()?.state.delete(SERVICES_PRESET);
}
