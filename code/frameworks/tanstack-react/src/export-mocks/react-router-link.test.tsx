// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

import { Link } from './react-router.ts';
import { onNavigate } from './spies.ts';

async function renderWithRouter(linkElement: React.ReactNode) {
  const root = createRootRoute();
  const index = createRoute({
    path: '/',
    getParentRoute: () => root,
    component: () => linkElement,
  });
  const user = createRoute({
    path: '/users/$userId',
    getParentRoute: () => root,
    component: () => null,
  });
  const files = createRoute({
    path: '/files/$',
    getParentRoute: () => root,
    component: () => null,
  });
  root.addChildren([index, user, files]);
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(<RouterProvider router={router as any} />);
  return router;
}

describe('Link mock', () => {
  it('interpolates path params into href and keeps params off the DOM', async () => {
    await renderWithRouter(
      <Link to="/users/$userId" params={{ userId: '42' }} data-testid="user-link">
        Ada
      </Link>
    );

    const link = await screen.findByTestId('user-link');
    expect(link.getAttribute('href')).toBe('/users/42');
    expect(link.hasAttribute('params')).toBe(false);
  });

  it('interpolates splat params', async () => {
    await renderWithRouter(
      <Link to="/files/$" params={{ _splat: 'reports/q2.pdf' }} data-testid="splat-link">
        Files
      </Link>
    );

    const link = await screen.findByTestId('splat-link');
    expect(link.getAttribute('href')).toBe('/files/reports/q2.pdf');
  });

  it('spies navigation instead of performing it', async () => {
    const router = await renderWithRouter(
      <Link to="/users/$userId" params={{ userId: '42' }} data-testid="user-link">
        Ada
      </Link>
    );

    fireEvent.click(await screen.findByTestId('user-link'));

    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/users/$userId' }));
    expect(router.state.location.pathname).toBe('/');
  });
});
