import type { Options } from 'storybook/internal/types';
import { describe, expect, it } from 'vitest';

import { getRefsFromConfig } from './get-refs-from-config.ts';

function optionsWithRefs(refs: unknown): Options {
  return { presets: { apply: async () => refs } } as unknown as Options;
}

describe('getRefsFromConfig', () => {
  it('turns each ref into a docs source keyed by its config key', async () => {
    const refs = await getRefsFromConfig(
      optionsWithRefs({
        'design-system': { title: 'Design System', url: 'https://ds.example.com' },
      })
    );

    expect(refs).toEqual([
      { id: 'design-system', title: 'Design System', url: 'https://ds.example.com' },
    ]);
  });

  it('strips a trailing slash from the url', async () => {
    const refs = await getRefsFromConfig(
      optionsWithRefs({ ds: { title: 'Design System', url: 'https://ds.example.com/' } })
    );

    expect(refs[0]?.url).toBe('https://ds.example.com');
  });

  it('excludes refs with disable: true, matching the sidebar', async () => {
    const refs = await getRefsFromConfig(
      optionsWithRefs({
        enabled: { title: 'Enabled', url: 'https://enabled.example.com' },
        disabled: { title: 'Disabled', url: 'https://disabled.example.com', disable: true },
      })
    );

    expect(refs.map((ref) => ref.id)).toEqual(['enabled']);
  });

  it('excludes refs without a url', async () => {
    const refs = await getRefsFromConfig(
      optionsWithRefs({
        broken: { title: 'Broken' },
        empty: { title: 'Empty', url: '' },
        nothing: null,
      })
    );

    expect(refs).toEqual([]);
  });

  it('lowercases the id and humanises the title like the sidebar does', async () => {
    const refs = await getRefsFromConfig(
      optionsWithRefs({ DesignSystem: { url: 'https://ds.example.com' } })
    );

    expect(refs).toEqual([
      { id: 'designsystem', title: 'Design System', url: 'https://ds.example.com' },
    ]);
  });

  it('lets a function-form refs config build on an object base', async () => {
    const options = {
      presets: {
        apply: async (_key: string, base: Record<string, unknown>) => {
          base.ds = { url: 'https://ds.example.com' };
          return base;
        },
      },
    } as unknown as Options;

    expect(await getRefsFromConfig(options)).toEqual([
      { id: 'ds', title: 'Ds', url: 'https://ds.example.com' },
    ]);
  });

  it('returns no sources when the project has no refs', async () => {
    expect(await getRefsFromConfig(optionsWithRefs(undefined))).toEqual([]);
    expect(await getRefsFromConfig(optionsWithRefs({}))).toEqual([]);
  });
});
