import { describe, expect, it } from 'vitest';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

import { duplicateRouteTree } from './duplicate-tree.ts';

describe('duplicateRouteTree', () => {
  it('uses a fresh preview root instead of copying source root options', () => {
    const SourceRootComponent = () => null;
    const sourceRootBeforeLoad = () => ({ fromSourceRoot: true });
    const root = createRootRoute({
      component: SourceRootComponent,
      beforeLoad: sourceRootBeforeLoad,
    });

    const { root: duplicatedRoot } = duplicateRouteTree(root);

    expect((duplicatedRoot as any).options.component).toBeUndefined();
    expect((duplicatedRoot as any).options.beforeLoad).toBeUndefined();
  });

  it('applies explicit root overrides to the fresh preview root', () => {
    const SourceRootComponent = () => null;
    const OverrideRootComponent = () => null;
    const overrideBeforeLoad = () => ({ fromOverrideRoot: true });
    const root = createRootRoute({
      component: SourceRootComponent,
    });

    const { root: duplicatedRoot } = duplicateRouteTree(root, {
      overrides: {
        __root__: {
          component: OverrideRootComponent,
          beforeLoad: overrideBeforeLoad,
        },
      } as any,
    });

    expect((duplicatedRoot as any).options.component).toBe(OverrideRootComponent);
    expect((duplicatedRoot as any).options.beforeLoad).toBe(overrideBeforeLoad);
  });

  it('preserves pathless layout routes as id-only routes', async () => {
    const root = createRootRoute();
    const authed = createRoute({
      id: '/_authed',
      getParentRoute: () => root,
      component: () => null,
    });
    const race = createRoute({
      path: 'races/$racePublicId/$raceSlug',
      getParentRoute: () => authed,
      component: () => null,
    });
    const test = createRoute({
      path: 'test',
      getParentRoute: () => race,
      component: () => null,
    });

    root.addChildren([authed.addChildren([race.addChildren([test])])]);

    const { root: duplicatedRoot, byId } = duplicateRouteTree(root);
    const clonedAuthed = byId.get(authed.id) as any;
    const clonedRace = byId.get(race.id) as any;
    const clonedTest = byId.get(test.id) as any;

    expect(clonedAuthed.options.id).toBe('/_authed');
    expect(clonedAuthed.options.path).toBeUndefined();

    const router = createRouter({
      routeTree: duplicatedRoot,
      history: createMemoryHistory({
        initialEntries: ['/races/dragonborn/dragonborn/test'],
      }),
    });
    await router.load();

    expect(router.state.matches.map((match) => match.routeId)).toEqual([
      duplicatedRoot.id,
      clonedAuthed.id,
      clonedRace.id,
      clonedTest.id,
    ]);
  });
});
