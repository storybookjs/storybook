import React from 'react';

import type { Meta, StoryObj } from '@storybook/tanstack-react';

import { Outlet, createRootRoute, createRoute, getRouteApi } from '@tanstack/react-router';
import { expect, within } from 'storybook/test';

const authenticatedRouteApi = getRouteApi('/_authenticated');
const testRouteApi = getRouteApi('/_authenticated/races/$racePublicId/$raceSlug/test');

function AuthenticatedLayout() {
  return (
    <section data-testid="pathless-layout">
      <h1>pathless layout</h1>
      <Outlet />
    </section>
  );
}

function RaceLayout() {
  return (
    <section data-testid="race-layout">
      <h2>nested race layout</h2>
      <Outlet />
    </section>
  );
}

function RouteStateProbe() {
  const context = authenticatedRouteApi.useRouteContext() as { sessionLabel: string };
  const params = testRouteApi.useParams() as {
    racePublicId: string;
    raceSlug: string;
  };

  return (
    <dl>
      <dt>route context</dt>
      <dd>{context.sessionLabel}</dd>
      <dt>route params</dt>
      <dd>
        {params.racePublicId}:{params.raceSlug}
      </dd>
    </dl>
  );
}

const RootRoute = createRootRoute();

const AuthenticatedRoute = createRoute({
  id: '/_authenticated',
  getParentRoute: () => RootRoute,
  beforeLoad: () => ({ sessionLabel: 'pathless route context' }),
  component: AuthenticatedLayout,
});

const RaceRoute = createRoute({
  path: 'races/$racePublicId/$raceSlug',
  getParentRoute: () => AuthenticatedRoute,
  component: RaceLayout,
});

const TestRoute = createRoute({
  path: 'test',
  getParentRoute: () => RaceRoute,
  component: RouteStateProbe,
});

RootRoute.addChildren([AuthenticatedRoute.addChildren([RaceRoute.addChildren([TestRoute])])]);

const meta = {
  component: RouteStateProbe,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof RouteStateProbe>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PreservesPathlessLayoutRouteState: Story = {
  parameters: {
    tanstack: {
      router: {
        route: TestRoute,
        params: {
          racePublicId: 'dragonborn',
          raceSlug: 'dragonborn',
        },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('heading', { level: 1, name: 'pathless layout' })).toBeVisible();
    await expect(
      canvas.getByRole('heading', { level: 2, name: 'nested race layout' })
    ).toBeVisible();
    await expect(canvas.getByText('pathless route context')).toBeVisible();
    await expect(canvas.getByText('dragonborn:dragonborn')).toBeVisible();
  },
};
