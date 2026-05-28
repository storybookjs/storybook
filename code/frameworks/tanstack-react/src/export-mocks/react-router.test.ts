import { describe, expect, it } from 'vitest';
import { createRootRoute } from '@tanstack/react-router';

import { createFileRoute } from './react-router.ts';

describe('createFileRoute', () => {
  it('keeps the route id while normalizing pathless group segments from path/fullPath', () => {
    const root = createRootRoute();
    const Route = createFileRoute('/(group)/page')({
      component: () => null,
      getParentRoute: () => root,
    });

    expect((Route as any).options.id).toBe('/(group)/page');
    expect((Route as any).options.path).toBe('/page');
  });

  it('normalizes a pure pathless group route to root path', () => {
    const root = createRootRoute();
    const Route = createFileRoute('/(group)')({
      component: () => null,
      getParentRoute: () => root,
    });

    expect((Route as any).options.id).toBe('/(group)');
    expect((Route as any).options.path).toBe('/');
  });
});
