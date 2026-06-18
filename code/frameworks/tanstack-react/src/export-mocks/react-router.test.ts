import { describe, expect, it, vi } from 'vitest';
import { createRootRoute } from '@tanstack/react-router';

vi.mock('storybook/test', () => ({
  fn: (implementation: unknown) => ({
    mockName: () => implementation,
  }),
}));
vi.mock('storybook/internal/preview-api', () => ({
  useEffect: () => undefined,
}));

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
    expect(Route.options.fullPath).toBe('/page');
  });

  it('normalizes nested pathless group segments', () => {
    const Route = build('/(a)/(b)/page');

    expect(Route.options.id).toBe('/(a)/(b)/page');
    expect(Route.options.path).toBe('/page');
    expect(Route.options.fullPath).toBe('/page');
  });

  it('normalizes a pure pathless group route to root path', () => {
    const Route = build('/(group)');

    expect(Route.options.id).toBe('/(group)');
    expect(Route.options.path).toBe('/');
    expect(Route.options.fullPath).toBe('/');
  });

  it('normalizes pathless `_layout` segments the same way the generator does', () => {
    const Route = build('/_layout/page');

    expect(Route.options.id).toBe('/_layout/page');
    expect(Route.options.path).toBe('/page');
    expect(Route.options.fullPath).toBe('/page');
  });

  it('keeps pure pathless `_layout` routes id-only', () => {
    const Route = build('/_layout');

    expect(Route.options.id).toBe('/_layout');
    expect(Route.options.path).toBeUndefined();
    expect(Route.options.fullPath).toBeUndefined();
  });

  it('normalizes a mix of `_layout` and `(group)` segments', () => {
    const Route = build('/_layout/(group)/page');

    expect(Route.options.id).toBe('/_layout/(group)/page');
    expect(Route.options.path).toBe('/page');
    expect(Route.options.fullPath).toBe('/page');
  });
});
