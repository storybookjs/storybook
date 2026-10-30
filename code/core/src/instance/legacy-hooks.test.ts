import { logger } from '@storybook/core/internal/node-logger';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { InstanceContext } from '../shared/instance-context.ts';
import { instanceContext } from './instance-context.ts';
import { defineLegacyFieldOptions } from './legacy-hooks.ts';
import type { Storybook } from './types.ts';

const PRESETS_LIST = [{ name: 'example', preset: {}, options: {} }];

function createContext(): InstanceContext {
  return {
    storybook: {
      addons: [{ name: '@storybook/addon-docs', kind: 'addon', order: 1 }],
    } as unknown as Storybook,
    state: new Map(),
  } as unknown as InstanceContext;
}

describe('defineLegacyFieldOptions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes addons as { name, kind } and hides both keys from spreads', () => {
    const options = instanceContext.run(createContext(), () =>
      defineLegacyFieldOptions({ configDir: '/config' }, PRESETS_LIST)
    );
    expect({
      spread: { ...options },
      addons: instanceContext.run(createContext(), () => options.addons),
    }).toMatchInlineSnapshot(`
      {
        "addons": [
          {
            "kind": "addon",
            "name": "@storybook/addon-docs",
          },
        ],
        "spread": {
          "configDir": "/config",
        },
      }
    `);
  });

  it.each([
    { name: 'one instance, two reads', contexts: 1, reads: 2, expected: 1 },
    { name: 'two instances, one read each', contexts: 2, reads: 1, expected: 2 },
  ])('warns about presetsList once per instance: $name', ({ contexts, reads, expected }) => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    for (let index = 0; index < contexts; index++) {
      instanceContext.run(createContext(), () => {
        const options = defineLegacyFieldOptions({}, PRESETS_LIST);
        for (let read = 0; read < reads; read++) {
          expect(options.presetsList).toBe(PRESETS_LIST);
        }
      });
    }
    expect(warn).toHaveBeenCalledTimes(expected);
  });
});
