import React from 'react';

import type { Meta, StoryObj } from '@storybook/tanstack-react';

import { Outlet, createRootRoute, createRoute, getRouteApi } from '@tanstack/react-router';
import { expect } from 'storybook/test';

const authedRouteApi = getRouteApi('/_authenticated');
const nestedRouteApi = getRouteApi('/_authenticated/races/$racePublicId/$raceSlug/test');

function DocumentRoot() {
  return (
    <html lang="en" data-testid="document-root">
      <body>
        <Outlet />
      </body>
    </html>
  );
}

function PathlessLayout() {
  return (
    <section data-testid="pathless-layout">
      <h1>Authenticated layout</h1>
      <Outlet />
    </section>
  );
}

function RaceLayout() {
  return (
    <section data-testid="race-layout">
      <Outlet />
    </section>
  );
}

function RouteStateProbe() {
  const authedContext = authedRouteApi.useRouteContext() as { sessionLabel: string };
  const params = nestedRouteApi.useParams() as {
    racePublicId: string;
    raceSlug: string;
  };

  return (
    <article>
      <p data-testid="route-context">{authedContext.sessionLabel}</p>
      <p data-testid="race-params">
        {params.racePublicId}:{params.raceSlug}
      </p>
    </article>
  );
}

const RootRoute = createRootRoute({
  component: DocumentRoot,
});

const AuthenticatedRoute = createRoute({
  id: '/_authenticated',
  getParentRoute: () => RootRoute,
  component: PathlessLayout,
  beforeLoad: () => ({ sessionLabel: 'pathless route context' }),
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
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId('pathless-layout')).toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Authenticated layout' })
    ).toBeInTheDocument();
    await expect(canvas.getByTestId('race-layout')).toBeInTheDocument();
    await expect(canvas.getByTestId('route-context')).toHaveTextContent('pathless route context');
    await expect(canvas.getByTestId('race-params')).toHaveTextContent('dragonborn:dragonborn');
    await expect(canvas.queryByTestId('document-root')).not.toBeInTheDocument();
  },
};
