import type { Storybook } from '@storybook/core';

import { describe, expect, it, vi } from 'vitest';

import { resolveInstanceFactory } from './instance-factory.ts';

const PROJECT_CORE = '/project/node_modules/@storybook/core';
const OTHER_CORE = '/other/node_modules/@storybook/core';
const INSTANCE_ENTRY = '/project/node_modules/storybook/dist/core/instance/index.js';

const explicit = vi.fn(async () => ({ id: 'explicit' }) as unknown as Storybook);
const product = vi.fn(async () => ({ id: 'product' }) as unknown as Storybook);
const core = vi.fn(async () => ({ id: 'core' }) as unknown as Storybook);

describe('resolveInstanceFactory', () => {
  it.each([
    {
      name: 'an explicit factory wins over a resolvable storybook',
      explicit,
      instanceEntry: INSTANCE_ENTRY,
      storybookCore: OTHER_CORE,
      expected: { kind: 'factory', id: 'explicit' },
    },
    {
      name: 'storybook on the same core provides the product factory',
      explicit: undefined,
      instanceEntry: INSTANCE_ENTRY,
      storybookCore: PROJECT_CORE,
      expected: { kind: 'factory', id: 'product' },
    },
    {
      name: 'storybook on another core is a mismatch',
      explicit: undefined,
      instanceEntry: INSTANCE_ENTRY,
      storybookCore: OTHER_CORE,
      expected: { kind: 'mismatch', projectCorePath: OTHER_CORE, callerCorePath: PROJECT_CORE },
    },
    {
      name: 'storybook whose core cannot be resolved is a mismatch',
      explicit: undefined,
      instanceEntry: INSTANCE_ENTRY,
      storybookCore: undefined,
      expected: { kind: 'mismatch', projectCorePath: undefined, callerCorePath: PROJECT_CORE },
    },
    {
      name: 'no storybook falls back to the core factory',
      explicit: undefined,
      instanceEntry: undefined,
      storybookCore: undefined,
      expected: { kind: 'factory', id: 'core' },
    },
  ])('$name', async ({ explicit, instanceEntry, storybookCore, expected }) => {
    const resolution = resolveInstanceFactory(
      { explicit, resolutionRoot: '/project' },
      {
        resolveInstanceEntry: () => instanceEntry,
        projectCorePath: () => storybookCore,
        callerCorePath: () => PROJECT_CORE,
        importInstanceEntry: async () => ({ createStorybook: product }),
        createCoreStorybook: core,
      }
    );

    const actual =
      resolution.kind === 'factory'
        ? {
            kind: resolution.kind,
            id: (
              (await resolution.createStorybook({
                configDir: '.storybook',
                mode: 'headless',
              })) as unknown as {
                id: string;
              }
            ).id,
          }
        : resolution;
    expect(actual).toEqual(expected);
  });

  it('defers importing the product entry until an instance is created', async () => {
    const importInstanceEntry = vi.fn(async () => ({ createStorybook: product }));

    const resolution = resolveInstanceFactory(
      { resolutionRoot: '/project' },
      {
        resolveInstanceEntry: () => INSTANCE_ENTRY,
        projectCorePath: () => PROJECT_CORE,
        callerCorePath: () => PROJECT_CORE,
        importInstanceEntry,
      }
    );

    expect(importInstanceEntry).not.toHaveBeenCalled();
    if (resolution.kind !== 'factory') {
      throw new Error('Expected a factory');
    }
    await resolution.createStorybook({ configDir: '.storybook', mode: 'headless' });
    expect(importInstanceEntry).toHaveBeenCalledWith(INSTANCE_ENTRY);
  });
});
