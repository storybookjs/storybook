import { describe, expect, it, vi } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { createCorePreset, getFrameworkBuilderOptions } from './get-builder-options';

function makeOptions(frameworkValue: unknown): Options {
  return {
    presets: { apply: vi.fn().mockResolvedValue(frameworkValue) },
  } as unknown as Options;
}

describe('getFrameworkBuilderOptions', () => {
  it('returns {} for a string framework or an object with no builder options', () => {
    expect(getFrameworkBuilderOptions('@storybook/react-webpack5')).toEqual({});
    expect(getFrameworkBuilderOptions({ name: '@storybook/react-webpack5' })).toEqual({});
    expect(
      getFrameworkBuilderOptions({ name: '@storybook/react-webpack5', options: { foo: 'bar' } })
    ).toEqual({});
  });

  it('returns the builder options when present', () => {
    const builderOptions = { fsCache: true };
    expect(
      getFrameworkBuilderOptions({
        name: '@storybook/react-webpack5',
        options: { builder: builderOptions },
      })
    ).toEqual(builderOptions);
  });
});

describe('createCorePreset', () => {
  it('produces the expected core config, merging incoming config and forwarding builder options', async () => {
    const builderOptions = { fsCache: true };
    const preset = createCorePreset({
      builderName: '@storybook/builder-webpack5',
      rendererName: '@storybook/react/preset',
    });

    const result = await preset(
      { disableTelemetry: true },
      makeOptions({ name: '@storybook/react-webpack5', options: { builder: builderOptions } })
    );

    expect(result).toMatchObject({
      disableTelemetry: true,
      builder: { name: '@storybook/builder-webpack5', options: builderOptions },
      renderer: '@storybook/react/preset',
    });
  });

  it('omits the renderer key when rendererName is not provided', async () => {
    const preset = createCorePreset({ builderName: '@storybook/builder-webpack5' });
    const result = await preset({}, makeOptions('@storybook/angular'));

    expect(result).not.toHaveProperty('renderer');
  });

  it('calls beforeReturn with the resolved framework and options', async () => {
    const hook = vi.fn();
    const framework = { name: '@storybook/nextjs', options: { nextConfigPath: '/next.config.js' } };
    const options = makeOptions(framework);

    await createCorePreset({ builderName: '@storybook/builder-webpack5', beforeReturn: hook })(
      {},
      options
    );

    expect(hook).toHaveBeenCalledOnce();
    expect(hook).toHaveBeenCalledWith(framework, options);
  });

  it('awaits an async beforeReturn hook before returning', async () => {
    let hookResolved = false;
    const asyncHook = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            hookResolved = true;
            resolve();
          }, 0)
        )
    );

    await createCorePreset({
      builderName: '@storybook/builder-webpack5',
      beforeReturn: asyncHook,
    })({}, makeOptions({ name: '@storybook/nextjs', options: {} }));

    expect(hookResolved).toBe(true);
    expect(asyncHook).toHaveBeenCalledOnce();
  });
});
