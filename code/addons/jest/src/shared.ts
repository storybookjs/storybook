import type { StorybookInternalParameters } from 'storybook/internal/types';

import invariant from 'tiny-invariant';

// addons, panels and events get unique names using a prefix
export const PARAM_KEY = 'test';
export const ADDON_ID = 'storybookjs/test';
export const PANEL_ID = `${ADDON_ID}/panel`;

export const ADD_TESTS = `${ADDON_ID}/add_tests`;

interface AddonParameters extends StorybookInternalParameters {
  jest?: string | string[] | { disabled: true };
}

export function defineJestParameter(parameters: AddonParameters): string[] | null {
  const { jest, fileName: filePath } = parameters;

  if (typeof jest === 'string') {
    return [jest];
  }

  if (jest && Array.isArray(jest)) {
    return jest;
  }

  if (jest === undefined && typeof filePath === 'string') {
    const lastPath = filePath.split('/').pop();
    invariant(lastPath != null, 'split should always return at least one value');
    const fileName = lastPath.split('.')[0];
    return [fileName];
  }

  return null;
}
