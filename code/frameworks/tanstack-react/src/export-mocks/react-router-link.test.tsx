// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  const posts = createRoute({
    path: '/posts',
    getParentRoute: () => root,
    validateSearch: (search: Record<string, unknown>) => ({
      tag: (search.tag as string) ?? undefined,
      page: (search.page as number) ?? undefined,
    }),
    component: () => null,
  });
  const about = createRoute({
    path: '/about',
    getParentRoute: () => root,
    component: () => null,
  });
  root.addChildren([index, user, files, posts, about]);
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(<RouterProvider router={router as any} />);
  return router;
}

describe('Link mock', () => {
  beforeEach(() => {
    onNavigate.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

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

  it('renders a static route href with no params', async () => {
    await renderWithRouter(
      <Link to="/about" data-testid="about-link">
        About
      </Link>
    );

    const link = await screen.findByTestId('about-link');
    expect(link.getAttribute('href')).toBe('/about');
  });

  it('serializes search params into the href', async () => {
    await renderWithRouter(
      <Link to="/posts" search={{ tag: 'news', page: 2 }} data-testid="search-link">
        News
      </Link>
    );

    const link = await screen.findByTestId('search-link');
    const href = link.getAttribute('href') ?? '';
    expect(href.startsWith('/posts?')).toBe(true);
    expect(href).toContain('tag=news');
    expect(href).toContain('page=2');
    expect(link.hasAttribute('search')).toBe(false);
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
