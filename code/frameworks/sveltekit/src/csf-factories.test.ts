// @vitest-environment happy-dom
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { Component } from 'svelte';

import { definePreview } from './index.ts';
import * as svelteKitPreview from './preview.ts';

type BadgeProps = { variant: 'primary' | 'secondary'; label: string };
const Badge = {} as Component<BadgeProps>;

const preview = definePreview({ addons: [] });

it('includes the SvelteKit mocks', () => {
  expect(preview.composed.beforeEach).toContain(svelteKitPreview.beforeEach);
});

it('infers the args from the component through the wrapper', () => {
  const meta = preview.meta({ component: Badge, args: { variant: 'primary' } });
  expectTypeOf(meta.input.args.variant).toEqualTypeOf<'primary' | 'secondary'>();

  // @ts-expect-error label is required
  const Missing = meta.story();
});

it('infers the args when the preview has no addons', () => {
  const noAddons = definePreview({ parameters: { layout: 'centered' } });
  const meta = noAddons.meta({ component: Badge, args: { variant: 'primary' } });
  const Default = meta.story({ args: { label: 'Hi' } });
  // @ts-expect-error label is required
  const Missing = meta.story();
});

describe('parameters.sveltekit_experimental', () => {
  it('is rejected in the preview, the meta and the story, since it was removed', () => {
    definePreview({
      addons: [],
      parameters: {
        // @ts-expect-error removed in Storybook 11
        sveltekit_experimental: { state: { updated: { current: true } } },
      },
    });

    const meta = preview.meta({
      component: Badge,
      args: { variant: 'primary', label: 'Hi' },
      parameters: {
        // @ts-expect-error removed in Storybook 11
        sveltekit_experimental: { state: { page: { status: 404 } } },
      },
    });
    const Default = meta.story({
      parameters: {
        // @ts-expect-error removed in Storybook 11
        sveltekit_experimental: { hrefs: { '/home': () => {} } },
      },
    });
  });
});
