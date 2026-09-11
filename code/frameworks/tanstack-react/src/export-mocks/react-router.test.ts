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
    expect(Route.options.fullPath).toBe('/page');
  });

  it('normalizes nested pathless group segments', () => {
    const Route = build('/(a)/(b)/page');

    expect(Route.options.id).toBe('/(a)/(b)/page');
    expect(Route.options.path).toBe('/page');
    expect(Route.options.fullPath).toBe('/page');
  });

  it('keeps a pathless layout nested under a pathful segment id-only', () => {
    const Route = build('/posts/_layout');

    expect(Route.options.id).toBe('/posts/_layout');
    expect(Route.options.path).toBeUndefined();
    expect(Route.options.fullPath).toBeUndefined();
  });

  it('keeps a group nested under a pathful segment id-only', () => {
    const Route = build('/posts/(admin)');

    expect(Route.options.id).toBe('/posts/(admin)');
    expect(Route.options.path).toBeUndefined();
    expect(Route.options.fullPath).toBeUndefined();
  });

  it('keeps a pure pathless group route id-only (no path)', () => {
    const Route = build('/(group)');

    expect(Route.options.id).toBe('/(group)');
    expect(Route.options.path).toBeUndefined();
    expect(Route.options.fullPath).toBeUndefined();
  });

  it('keeps a pure pathless layout route id-only (no path)', () => {
    const Route = build('/_authed');

    expect(Route.options.id).toBe('/_authed');
    expect(Route.options.path).toBeUndefined();
    expect(Route.options.fullPath).toBeUndefined();
  });

  it('keeps the root index route path', () => {
    const Route = build('/');

    expect(Route.options.id).toBe('/');
    expect(Route.options.path).toBe('/');
    expect(Route.options.fullPath).toBe('/');
  });

  it('trims trailing-underscore (un-nesting) segments', () => {
    const Route = build('/posts_/$postId');

    expect(Route.options.id).toBe('/posts_/$postId');
    expect(Route.options.path).toBe('/posts/$postId');
    expect(Route.options.fullPath).toBe('/posts/$postId');
  });

  it('normalizes pathless `_layout` segments the same way the generator does', () => {
    const Route = build('/_layout/page');

    expect(Route.options.id).toBe('/_layout/page');
    expect(Route.options.path).toBe('/page');
    expect(Route.options.fullPath).toBe('/page');
  });

  it('normalizes a mix of `_layout` and `(group)` segments', () => {
    const Route = build('/_layout/(group)/page');

    expect(Route.options.id).toBe('/_layout/(group)/page');
    expect(Route.options.path).toBe('/page');
    expect(Route.options.fullPath).toBe('/page');
  });

  it('lets an explicit options.path win over a pathless id', () => {
    const root = createRootRoute();
    const Route = createFileRoute('/_authed')({
      component: () => null,
      getParentRoute: () => root,
      path: '/authed',
    }) as any;

    expect(Route.options.id).toBe('/_authed');
    expect(Route.options.path).toBe('/authed');
  });

  it('treats an empty id as the root index path', () => {
    const Route = build('');

    expect(Route.options.path).toBe('/');
    expect(Route.options.fullPath).toBe('/');
  });
});
