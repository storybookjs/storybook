import { describe, expect, it } from 'vitest';
import { createRootRoute } from '@tanstack/react-router';

import { createFileRoute } from './react-router.ts';

const build = (path: string) => {
  const root = createRootRoute();
  return createFileRoute(path)({
    component: () => null,
    getParentRoute: () => root,
  }) as any;
};

describe('createFileRoute', () => {
  it('keeps the route id while normalizing pathless group segments', () => {
    const Route = build('/(group)/page');

    expect(Route.options.id).toBe('/(group)/page');
    expect(Route.options.path).toBe('/page');
    expect(Route.fullPath).toBe('/page');
  });

  it('normalizes nested pathless group segments', () => {
    const Route = build('/(a)/(b)/page');

    expect(Route.options.id).toBe('/(a)/(b)/page');
    expect(Route.options.path).toBe('/page');
    expect(Route.fullPath).toBe('/page');
  });

  it('normalizes a pure pathless group route to root path', () => {
    const Route = build('/(group)');

    expect(Route.options.id).toBe('/(group)');
    expect(Route.options.path).toBe('/');
    expect(Route.fullPath).toBe('/');
  });

  it('normalizes pathless `_layout` segments the same way the generator does', () => {
    const Route = build('/_layout/page');

    expect(Route.options.id).toBe('/_layout/page');
    expect(Route.options.path).toBe('/page');
    expect(Route.fullPath).toBe('/page');
  });

  it('normalizes a mix of `_layout` and `(group)` segments', () => {
    const Route = build('/_layout/(group)/page');

    expect(Route.options.id).toBe('/_layout/(group)/page');
    expect(Route.options.path).toBe('/page');
    expect(Route.fullPath).toBe('/page');
  });
});
