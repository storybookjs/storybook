import type { StorybookFeatures } from '@storybook/core/internal/types';

import { getInstanceContext } from './instance-context.ts';

/** Read the feature flags of the running Storybook instance, or those injected into this page. */
export function getFeatures(): StorybookFeatures {
  const context = getInstanceContext();
  if (context) {
    return context.features ?? {};
  }
  return (globalThis as { FEATURES?: StorybookFeatures }).FEATURES ?? {};
}
