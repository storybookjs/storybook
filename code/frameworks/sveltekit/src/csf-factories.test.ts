// @vitest-environment happy-dom
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { Component } from 'svelte';

import { fn } from 'storybook/test';

import { definePreview } from './index.ts';
import * as svelteKitPreview from './preview.ts';

type BadgeProps = { variant: 'primary' | 'secondary'; label: string };
const Badge = {} as Component<BadgeProps>;

const preview = definePreview({ addons: [] });

it('includes the SvelteKit mocks', () => {
  expect(preview.composed.decorators).toEqual(expect.arrayContaining(svelteKitPreview.decorators));
  expect(preview.composed.beforeEach).toContain(svelteKitPreview.beforeEach);
});

it('infers the args from the component through the wrapper', () => {
  const meta = preview.meta({ component: Badge, args: { variant: 'primary' } });
  expectTypeOf(meta.input.args.variant).toEqualTypeOf<'primary' | 'secondary'>();

  // @ts-expect-error label is required
  const Missing = meta.story();
});

it('infers the args when the preview has no addons', () => {
  const noAddons = definePreview({
    parameters: { sveltekit_experimental: { state: { page: { status: 404 } } } },
  });
  const meta = noAddons.meta({ component: Badge, args: { variant: 'primary' } });
  const Default = meta.story({ args: { label: 'Hi' } });
  // @ts-expect-error label is required
  const Missing = meta.story();
});

describe('parameters.sveltekit_experimental', () => {
  it('accepts mocks that return nothing, as the docs show', () => {
    const meta = preview.meta({ component: Badge, args: { variant: 'primary', label: 'Hi' } });
    const Callbacks = meta.story({
      parameters: {
        sveltekit_experimental: {
          forms: { enhance: () => {} },
          navigation: { goto: (url: string) => {}, invalidateAll: () => {} },
        },
      },
    });
    const Mocks = meta.story({
      parameters: {
        sveltekit_experimental: { forms: { enhance: fn() }, navigation: { goto: fn() } },
      },
    });
  });

  it('accepts the page error of SvelteKit, an object with a message', () => {
    const meta = preview.meta({ component: Badge, args: { variant: 'primary', label: 'Hi' } });
    const NotFound = meta.story({
      parameters: {
        sveltekit_experimental: {
          state: { page: { status: 404, error: { message: 'Not found', code: 'E404' } } },
        },
      },
    });
    const Thrown = meta.story({
      parameters: { sveltekit_experimental: { state: { page: { error: new Error('Boom') } } } },
    });
  });

  it('is typed in the preview, the meta and the story', () => {
    definePreview({
      addons: [],
      parameters: { sveltekit_experimental: { state: { updated: { current: true } } } },
    });

    const meta = preview.meta({
      component: Badge,
      args: { variant: 'primary', label: 'Hi' },
      parameters: { sveltekit_experimental: { state: { page: { status: 404 } } } },
    });
    const Default = meta.story({
      parameters: { sveltekit_experimental: { hrefs: { '/home': () => {} } } },
    });
  });

  it('rejects invalid mocks', () => {
    const meta = preview.meta({ component: Badge, args: { variant: 'primary', label: 'Hi' } });
    meta.story({
      parameters: {
        sveltekit_experimental: {
          // @ts-expect-error status must be a number
          state: { page: { status: '404' } },
        },
      },
    });
  });
});
