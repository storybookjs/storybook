import { describe, expect, it } from 'vitest';

import { type Overrides, getOverriddenPackages, toOverrides } from './overrides.ts';

describe('toOverrides', () => {
  it.each([
    { name: 'a non-object field', input: 'storybook@10', expected: undefined },
    { name: 'an array field', input: ['storybook'], expected: undefined },
    {
      name: 'ranges and nested scopes',
      input: { storybook: '~10.5.3', a: { '.': '1.0.0', b: '2.0.0' } },
      expected: { storybook: '~10.5.3', a: { '.': '1.0.0', b: '2.0.0' } },
    },
    { name: 'a bare numeric pin', input: { storybook: 10 }, expected: { storybook: '10' } },
    {
      name: 'entries that are neither ranges nor scopes',
      input: { a: true, b: ['1'], c: null, d: '1.0.0' },
      expected: { d: '1.0.0' },
    },
  ])('$name', ({ input, expected }) => {
    expect(toOverrides(input)).toEqual(expected);
  });
});

describe('getOverriddenPackages', () => {
  it.each<{ name: string; overrides: Overrides }>([
    { name: 'a top level override', overrides: { '@storybook/react': '11.0.0-beta.3' } },
    { name: 'a version qualified key', overrides: { '@storybook/react@^11.0.0': '11.0.0-beta.3' } },
    {
      name: 'a Yarn descriptor key',
      overrides: { '@storybook/react@npm:^11.0.0': '11.0.0-beta.3' },
    },
    { name: 'a pnpm parent selector', overrides: { 'parent@1>@storybook/react': '11.0.0-beta.3' } },
    { name: 'a Yarn parent path', overrides: { 'parent/@storybook/react': '11.0.0-beta.3' } },
    { name: 'a Yarn glob path', overrides: { '**/@storybook/react': '11.0.0-beta.3' } },
    { name: 'an npm nested scope', overrides: { parent: { '@storybook/react': '11.0.0-beta.3' } } },
  ])('finds the package targeted by $name', ({ overrides }) => {
    expect([
      ...getOverriddenPackages([{ path: 'package.json', field: 'overrides', overrides }]),
    ]).toEqual(['@storybook/react']);
  });

  it('counts an npm scope as overridden only through its dot entry', () => {
    expect(
      getOverriddenPackages([
        {
          path: 'package.json',
          field: 'overrides',
          overrides: {
            '@storybook/react-native': { '@storybook/react': '11.0.0-beta.3' },
            '@storybook/addon-ondevice-actions': { '.': '11.0.0-next.2' },
          },
        },
        { path: 'pnpm-workspace.yaml', field: 'overrides', overrides: { storybook: '$storybook' } },
      ])
    ).toEqual(new Set(['@storybook/react', '@storybook/addon-ondevice-actions', 'storybook']));
  });
});
