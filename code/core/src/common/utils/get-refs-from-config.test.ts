import { logger } from '@storybook/core/internal/node-logger';
import type { Storybook } from '../../instance/types.ts';
import { describe, expect, it, vi } from 'vitest';

import { getRefsFromConfig } from './get-refs-from-config.ts';

vi.mock('@storybook/core/internal/node-logger', { spy: true });

function storybookWithRefs(refs: unknown): Pick<Storybook, 'callHook'> {
  return { callHook: async () => refs } as unknown as Pick<Storybook, 'callHook'>;
}

describe('getRefsFromConfig', () => {
  it('turns each ref into a docs source keyed by its config key', async () => {
    const refs = await getRefsFromConfig(
      storybookWithRefs({
        'design-system': { title: 'Design System', url: 'https://ds.example.com' },
      })
    );

    expect(refs).toEqual([
      { id: 'design-system', title: 'Design System', url: 'https://ds.example.com' },
    ]);
  });

  it('strips a trailing slash from the url', async () => {
    const refs = await getRefsFromConfig(
      storybookWithRefs({ ds: { title: 'Design System', url: 'https://ds.example.com/' } })
    );

    expect(refs[0]?.url).toBe('https://ds.example.com');
  });

  it('excludes refs with disable: true, matching the sidebar', async () => {
    const refs = await getRefsFromConfig(
      storybookWithRefs({
        enabled: { title: 'Enabled', url: 'https://enabled.example.com' },
        disabled: { title: 'Disabled', url: 'https://disabled.example.com', disable: true },
      })
    );

    expect(refs.map((ref) => ref.id)).toEqual(['enabled']);
  });

  it('excludes refs without a string url', async () => {
    const refs = await getRefsFromConfig(
      storybookWithRefs({
        broken: { title: 'Broken' },
        empty: { title: 'Empty', url: '' },
        object: { title: 'Object', url: new URL('https://object.example.com') },
        number: { title: 'Number', url: 42 },
        nothing: null,
      })
    );

    expect(refs).toEqual([]);
  });

  it('returns no sources and warns when the refs config throws', async () => {
    const storybook = {
      callHook: async () => {
        throw new Error('Config error');
      },
    } as unknown as Pick<Storybook, 'callHook'>;

    expect(await getRefsFromConfig(storybook)).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Config error'));
  });

  it('leaves out a ref keyed local, which would collide with the local source', async () => {
    const refs = await getRefsFromConfig(
      storybookWithRefs({
        Local: { url: 'https://local.example.com' },
        ds: { url: 'https://ds.example.com' },
      })
    );

    expect(refs.map((ref) => ref.id)).toEqual(['ds']);
  });

  it('lowercases the id and humanises the title like the sidebar does', async () => {
    const refs = await getRefsFromConfig(
      storybookWithRefs({ DesignSystem: { url: 'https://ds.example.com' } })
    );

    expect(refs).toEqual([
      { id: 'designsystem', title: 'Design System', url: 'https://ds.example.com' },
    ]);
  });

  it('lets a function-form refs config build on an object base', async () => {
    const storybook = {
      callHook: async (_name: string, base: Record<string, unknown>) => {
        base.ds = { url: 'https://ds.example.com' };
        return base;
      },
    } as unknown as Pick<Storybook, 'callHook'>;

    expect(await getRefsFromConfig(storybook)).toEqual([
      { id: 'ds', title: 'Ds', url: 'https://ds.example.com' },
    ]);
  });

  it('returns no sources when the project has no refs', async () => {
    expect(await getRefsFromConfig(storybookWithRefs(undefined))).toEqual([]);
    expect(await getRefsFromConfig(storybookWithRefs({}))).toEqual([]);
  });
});
