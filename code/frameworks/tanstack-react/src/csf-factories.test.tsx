// @vitest-environment happy-dom
import { describe, expectTypeOf, it } from 'vitest';

import React from 'react';

import { createRootRoute, createRoute } from '@tanstack/react-router';

import { definePreview } from './index.ts';

type BadgeProps = { variant: 'primary' | 'secondary'; label: string; onDismiss: () => void };
const Badge = ({ label }: BadgeProps) => <>{label}</>;

const preview = definePreview({ addons: [] });

describe('Meta args are typed by the keys you provide', () => {
  it('without a route', () => {
    const meta = preview.meta({
      component: Badge,
      args: { variant: 'primary', onDismiss: () => {} },
    });
    expectTypeOf(meta.input.args.variant).toEqualTypeOf<'primary' | 'secondary'>();

    const Default = meta.story({ args: { label: 'Hi' } });
    // @ts-expect-error label is required
    const Missing = meta.story();

    preview.meta({
      component: Badge,
      args: {
        // @ts-expect-error not a variant
        variant: 'tertiary',
      },
    });
    preview.meta({
      component: Badge,
      args: {
        variant: 'primary',
        // @ts-expect-error not a prop of Badge
        unknown: true,
      },
    });
  });

  it('with a route', () => {
    const RootRoute = createRootRoute({});
    const LeafRoute = createRoute({ getParentRoute: () => RootRoute, path: '/' });

    const meta = preview.meta({
      component: Badge,
      args: { variant: 'secondary' },
      parameters: { tanstack: { router: { route: LeafRoute } } },
    });
    const Default = meta.story({ args: { label: 'Hi', onDismiss: () => {} } });
  });
});
