import { createRootRoute } from '@tanstack/react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storybookTestMock = vi.hoisted(() => ({
  fn: vi.fn<(implementation: unknown) => { mockName: () => unknown }>(),
}));
const previewApiMock = vi.hoisted(() => ({
  useEffect: vi.fn<() => undefined>(),
}));

// @ts-expect-error Vitest supports factory mocks with spy options, but the pinned types only expose the two-argument overload.
vi.mock('storybook/test', () => storybookTestMock, { spy: true });
// @ts-expect-error Vitest supports factory mocks with spy options, but the pinned types only expose the two-argument overload.
vi.mock('storybook/internal/preview-api', () => previewApiMock, { spy: true });

let createFileRoute: typeof import('./react-router.ts').createFileRoute;

beforeEach(async () => {
  vi.resetModules();
  vi.mocked(storybookTestMock.fn).mockImplementation((implementation: unknown) => ({
    mockName: () => implementation,
  }));
  vi.mocked(previewApiMock.useEffect).mockImplementation(() => undefined);

  ({ createFileRoute } = await import('./react-router.ts'));
});

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
