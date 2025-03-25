import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import type {
  CoreCommon_AddonEntry,
  CoreCommon_AddonInfo,
  CoreCommon_OptionsEntry,
} from 'storybook/internal/types';

import { checkAddonOrder } from '../check-addon-order';

const configFile = './main.js';
const essentialAddons = ['backgrounds', 'viewport', 'measure', 'outline', 'highlight'];

const pkgName = (entry: CoreCommon_AddonEntry): string => {
  if (typeof entry === 'string') {
    if (entry.includes('node_modules')) {
      return entry;
    }
    return `@storybook/addon-${entry}`;
  }
  return (entry as CoreCommon_OptionsEntry).name;
};

const fromName = (name: string): CoreCommon_AddonInfo => ({
  name: pkgName(name),
  inEssentials: essentialAddons.includes(name),
});

const str = (name: unknown) => JSON.stringify(name);

const warn = vi.spyOn(logger, 'warn');
afterEach(() => {
  warn.mockReset();
});

describe.each([
  ['backgrounds', 'viewport', ['backgrounds', 'viewport']],
  ['backgrounds', 'viewport', ['backgrounds', 'foo/node_modules/@storybook/addon-viewport']],
  [
    'backgrounds',
    'measure',
    [
      'foo\\node_modules\\@storybook\\addon-essentials',
      'foo\\node_modules\\@storybook\\addon-measure',
    ],
  ],
  [
    'viewport',
    'outline',
    [
      'foo\\\\node_modules\\\\@storybook\\\\addon-essentials',
      'foo\\\\node_modules\\\\@storybook\\\\addon-outline',
    ],
  ],
  ['backgrounds', 'viewport', [{ name: '@storybook/addon-backgrounds' }, 'viewport']],
  ['backgrounds', 'viewport', ['essentials', 'viewport']],
  ['backgrounds', 'viewport', ['essentials']],
])('checkAddonOrder', (_before, _after, _addons) => {
  it(`${str(_before)} before ${str(_after)} in [${_addons.map(str).join(', ')}]`, async () => {
    const before = fromName(_before);
    const after = fromName(_after);
    const addons = _addons.map(pkgName);
    await checkAddonOrder({ before, after, configFile, getConfig: () => ({ addons }) });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe.each([
  ['backgrounds', 'viewport', []],
  ['backgrounds', 'viewport', ['viewport']],
  ['backgrounds', 'viewport', ['backgrounds']],
  ['backgrounds', 'viewport', ['viewport', 'backgrounds']],
  ['backgrounds', 'viewport', ['essentials', 'backgrounds']],
  ['backgrounds', 'viewport', ['viewport', 'essentials']],
  ['backgrounds', 'viewport', ['essentials', 'viewport', 'backgrounds']],
])('checkAddonOrder', (_before, _after, _addons) => {
  it(`${str(_before)} not before ${str(_after)} in [${_addons.map(str).join(', ')}]`, async () => {
    const before = fromName(_before);
    const after = fromName(_after);
    const addons = _addons.map(pkgName);
    await checkAddonOrder({ before, after, configFile, getConfig: () => ({ addons }) });
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`Expected '${before.name}' .* to be listed before '${after.name}'`)
      )
    );
  });
});
