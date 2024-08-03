import { afterEach, it, expect, vi, describe } from 'vitest';
import { logger } from '@storybook/core/node-logger';
import type {
  CoreCommon_AddonEntry,
  CoreCommon_AddonInfo,
  CoreCommon_OptionsEntry,
} from '@storybook/core/types';
import { checkAddonOrder } from '../check-addon-order';

const configFile = './main.js';
const essentialAddons = [
  'docs',
  'controls',
  'actions',
  'backgrounds',
  'viewport',
  'toolbars',
  'measure',
  'outline',
  'highlight',
];

const pkgName = (entry: CoreCommon_AddonEntry): string => {
  if (typeof entry === 'string') {
    if (entry.includes('node_modules')) return entry;
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
  ['docs', 'controls', ['docs', 'controls']],
  ['docs', 'controls', ['docs', 'foo/node_modules/@storybook/addon-controls']],
  [
    'actions',
    'interactions',
    [
      'foo\\node_modules\\@storybook\\addon-essentials',
      'foo\\node_modules\\@storybook\\addon-interactions',
    ],
  ],
  [
    'actions',
    'interactions',
    [
      'foo\\\\node_modules\\\\@storybook\\\\addon-essentials',
      'foo\\\\node_modules\\\\@storybook\\\\addon-interactions',
    ],
  ],
  ['docs', 'controls', [{ name: '@storybook/addon-docs' }, 'controls']],
  ['docs', 'controls', ['essentials', 'controls']],
  ['docs', 'controls', ['essentials']],
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
  ['docs', 'controls', []],
  ['docs', 'controls', ['controls']],
  ['docs', 'controls', ['docs']],
  ['docs', 'controls', ['controls', 'docs']],
  ['docs', 'controls', ['essentials', 'docs']],
  ['docs', 'controls', ['controls', 'essentials']],
  ['docs', 'controls', ['essentials', 'controls', 'docs']],
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
