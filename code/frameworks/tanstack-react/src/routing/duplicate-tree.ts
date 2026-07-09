import type { AnyRootRoute, AnyRoute } from '@tanstack/react-router';
import {
  createRoute,
  RootRoute,
  createRootRouteWithContext,
  joinPaths,
} from '@tanstack/react-router';

import type { RouteTreeOverrides } from './types.ts';

const MAX_PARENT_WALK = 50;

export interface DuplicateRouteTreeOptions {
  overrides?: RouteTreeOverrides | undefined;
}

export interface DuplicatedTree {
  root: AnyRootRoute;
  byId: Map<string, AnyRoute>;
}

/**
 * Walks up `getParentRoute()` from any route to find the enclosing `RootRoute`.
 *
 * Falls back to the input route if no parent chain leads to a `RootRoute`
 * (e.g. when the user constructed a stand-alone route by hand). The walk is
 * capped at `MAX_PARENT_WALK` hops to defend against accidental cycles.
 */
export function findRootRoute(route: AnyRoute): AnyRoute | undefined {
  let current: AnyRoute | undefined = route;
  for (let i = 0; i < MAX_PARENT_WALK && current; i += 1) {
    if (current instanceof RootRoute) {
      return current;
    }
    const getParent: () => AnyRoute = current.options?.getParentRoute;
    const parent = typeof getParent === 'function' ? getParent() : undefined;

    current = parent;
  }
}

function getOverrideFor(
  overrides: RouteTreeOverrides | undefined,
  routeId: string
): Record<string, unknown> {
  if (!overrides) {
    return {};
  }
  return ((overrides as Record<string, unknown>)[routeId] as Record<string, unknown>) ?? {};
}

function initSourceTree(route: AnyRoute, counter: { i: number }): void {
  route.init({ originalIndex: counter.i });
  counter.i += 1;
  const children = route.children as AnyRoute[] | undefined;
  if (children?.length) {
    for (const child of children) {
      initSourceTree(child, counter);
    }
  }
}

function cloneChild(
  oldRoute: AnyRoute,
  parent: AnyRoute,
  overrides: RouteTreeOverrides | undefined,
  byId: Map<string, AnyRoute>
): AnyRoute {
  const options = (oldRoute as any).options ?? {};
  // Strip identity / parent-link options so the cloned route gets its identity
  // derived from the new parent + path, and its parent linked to the cloned
  // parent below. Keeping the original `id` would cause TanStack to register
  // two routes with the same generated id (e.g. `__root__/about`).
  const { id: originalId, getParentRoute: _g, ...rest } = options;
  const override = getOverrideFor(overrides, oldRoute.id);
  const merged = { ...rest, ...override };

  // Use `createRoute` (not `createFileRoute`) for nested clones: `createFileRoute`
  // registers the route in TanStack's global file-route registry by path, so
  // re-running the duplication on every story re-render registers a duplicate
  // and TanStack throws `Duplicate routeIds found: __root__`.
  // A pathless route (explicit `id`, no `path` — checked AFTER overrides, so
  // an override that adds a `path` re-derives identity from the path instead
  // of crashing on TanStack's id+path invariant) has no path to derive an
  // identity from; its explicit id IS its identity, so preserve it. The falsy
  // check also treats `path: ''` as pathless.
  const cloned = createRoute({
    ...(!merged.path && originalId != null ? { id: originalId } : {}),
    ...merged,
    getParentRoute: () => parent as any,
  } as any);

  byId.set(oldRoute.id, cloned as unknown as AnyRoute);

  const children = (oldRoute as any).children as AnyRoute[] | undefined;
  if (children?.length) {
    const clonedChildren = children.map((child) =>
      cloneChild(child, cloned as unknown as AnyRoute, overrides, byId)
    );
    (cloned as any).addChildren(clonedChildren);
  }

  return cloned as unknown as AnyRoute;
}

/**
 * Recursively clones a TanStack Router tree starting from a `RootRoute`,
 * applying per-route option overrides keyed by `route.id`.
 *
 * Existing route instances are not mutated — every node in the tree is
 * rebuilt via `createRootRoute` / `createRoute` so the cloned tree can be
 * safely mounted in a story-scoped router without leaking state across
 * stories.
 */
export function duplicateRouteTree(
  rootRoute: AnyRoute,
  { overrides }: DuplicateRouteTreeOptions = {}
): DuplicatedTree {
  // init route to get all derived properties populated
  initSourceTree(rootRoute, { i: 0 });

  const byId = new Map<string, AnyRoute>();
  const rootOptions = (rootRoute as any).options ?? {};
  const rootOverride = getOverrideFor(overrides, '__root__');

  // Always build a fresh `RootRoute` instead of reusing / mutating the
  // caller's root. Reusing the same root across multiple story routers is
  // what causes TanStack to report a duplicated `__root__` id when more than
  // one story is mounted in the same browser session (e.g. HMR, navigation).
  // We strip `id` from spread options so TanStack assigns the canonical
  // `__root__` id itself.
  const { id: _rootId, getParentRoute: _rootGetParent, ...restRoot } = rootOptions;
  const newRoot = createRootRouteWithContext()({
    ...restRoot,
    ...rootOverride,
  } as any);
  byId.set('__root__', newRoot as unknown as AnyRoute);

  const children = (rootRoute as any).children as AnyRoute[] | undefined;
  if (children?.length) {
    const clonedChildren = children.map((child) =>
      cloneChild(child, newRoot as unknown as AnyRoute, overrides, byId)
    );
    (newRoot as any).addChildren(clonedChildren);
  }

  return { root: newRoot, byId };
}

/**
 * URL contributed by a route's pathful ancestors (pathless segments contribute
 * nothing). A bare `/` segment (an index route) likewise contributes nothing
 * beyond its parent's own path — including it as a literal segment would
 * leave a stray trailing slash once `joinPaths` collapses the rest.
 *
 * Cloned routes are not `init()`ed until `createRouter()` runs, so their
 * `fullPath`/`id` getters are undefined at resolution time; this walk reads
 * the cloned parent chain's options instead.
 */
export function mountPathFor(route: AnyRoute): string {
  const segments: string[] = [];
  let current: AnyRoute | undefined = route;
  for (let i = 0; i < MAX_PARENT_WALK && current; i += 1) {
    const routePath = (current as any).options?.path as string | undefined;
    if (routePath && routePath !== '/') {
      segments.unshift(routePath);
    }
    const getParent: (() => AnyRoute) | undefined = (current as any).options?.getParentRoute;
    current = typeof getParent === 'function' ? getParent() : undefined;
  }
  return joinPaths(['/', ...segments]);
}

/**
 * The original (pre-clone) id of a cloned route — the key users address it by
 * in `routeOverrides`. The clone's own `id` getter is init-backed and
 * undefined at resolution time.
 */
export function originalRouteId(tree: DuplicatedTree, route: AnyRoute): string | undefined {
  for (const [id, cloned] of tree.byId) {
    if (cloned === route) {
      return id;
    }
  }
  return undefined;
}

/**
 * Picks the route in the cloned tree that should host the `<Story />`.
 *
 * Resolution order:
 *
 * 1. The route whose `fullPath` exactly matches the explicit `path` parameter.
 * 2. The route bound to the story (`boundRouteId`), if it is present in the cloned tree.
 * 3. The first top-level child of the root.
 * 4. The root itself.
 */
export function resolveStoryLeaf(
  tree: DuplicatedTree,
  { path, boundRouteId }: { path?: string | undefined; boundRouteId?: string | undefined }
): AnyRoute {
  const { root, byId } = tree;

  if (path) {
    let bestMatch: AnyRoute | undefined;
    let bestMatchLength = -1;
    for (const route of byId.values()) {
      const fullPath = (route as any).fullPath as string | undefined;
      if (fullPath && fullPath === path && fullPath.length > bestMatchLength) {
        bestMatch = route;
        bestMatchLength = fullPath.length;
      }
    }
    if (bestMatch) {
      return bestMatch;
    }
  }

  if (boundRouteId) {
    const bound = byId.get(boundRouteId);
    if (bound) {
      return bound;
    }
  }

  const firstChild = (root.children as AnyRoute[] | undefined)?.[0];
  if (firstChild) {
    return firstChild;
  }

  return root as unknown as AnyRoute;
}
