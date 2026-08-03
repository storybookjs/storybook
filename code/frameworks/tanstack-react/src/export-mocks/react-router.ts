import { createRoute } from '@tanstack/react-router';
export * from '@tanstack/react-router';

import { fn } from 'storybook/test';
import React from 'react';
import { useEffect } from 'storybook/internal/preview-api';

import {
  useNavigate as _useNavigate,
  useRouter as _useRouter,
  useBlocker as _useBlocker,
  useMatch as _useMatch,
  useSearch as _useSearch,
  useParams as _useParams,
  useLocation as _useLocation,
  useRouterState as _useRouterState,
  useMatchRoute as _useMatchRoute,
  useLoaderData as _useLoaderData,
  useLoaderDeps as _useLoaderDeps,
  useRouteContext as _useRouteContext,
  useMatches as _useMatches,
  useParentMatches as _useParentMatches,
  useChildMatches as _useChildMatches,
  useCanGoBack as _useCanGoBack,
  useLinkProps as _useLinkProps,
} from '@tanstack/react-router';
import type { Navigate as _Navigate } from '@tanstack/react-router';
import { onNavigate } from './spies.ts';
import { isPathlessFileRouteId, normalizeFileRoutePath } from '../routing/path-utils.ts';

// Mock navigation hooks — backed by real implementations so they work in stories
export const useNavigate = fn(_useNavigate).mockName('@tanstack/react-router::useNavigate');
export const useRouter = fn(_useRouter).mockName('@tanstack/react-router::useRouter');
export const useBlocker = fn(_useBlocker).mockName('@tanstack/react-router::useBlocker');
export const useSearch = fn(_useSearch).mockName('@tanstack/react-router::useSearch');
export const useParams = fn(_useParams).mockName('@tanstack/react-router::useParams');
export const useLocation = fn(_useLocation).mockName('@tanstack/react-router::useLocation');
export const useRouterState = fn(_useRouterState).mockName(
  '@tanstack/react-router::useRouterState'
);
export const useLoaderData = fn(_useLoaderData).mockName('@tanstack/react-router::useLoaderData');
export const useLoaderDeps = fn(_useLoaderDeps).mockName('@tanstack/react-router::useLoaderDeps');
export const useRouteContext = fn(_useRouteContext).mockName(
  '@tanstack/react-router::useRouteContext'
);
export const useCanGoBack = fn(_useCanGoBack).mockName('@tanstack/react-router::useCanGoBack');
export const useLinkProps = fn(_useLinkProps).mockName('@tanstack/react-router::useLinkProps');

export const Navigate: typeof _Navigate = ({ to, href }) => {
  useEffect(() => {
    onNavigate({ to: (to as string) || href });
  }, [to, href]);

  return null;
};

export const Link = ({
  to,
  children,
  ...props
}: {
  to: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}) => {
  const location = useLocation();
  return React.createElement(
    'a',
    {
      href: to,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        onNavigate({ to, from: location.href });
      },
      ...props,
    },
    children
  );
};

/**
 * Override createFileRoute from tanstack react router
 * because the org `createFileRoute` doesn't set the path in the Route
 */
export function createFileRoute(path: string) {
  return (options: any) => {
    // A pure-pathless id (`/_authed`, `/(group)`) yields an id-only route: a
    // layout with `path: '/'` never matches its children and collides with a
    // sibling index route (see routing/duplicate-tree.test.ts). An explicit
    // `path` in the options keeps the route pathful and wins over the id.
    const pathless = isPathlessFileRouteId(path) && options?.path == null;
    const routePath = options?.path ?? normalizeFileRoutePath(path);
    return createRoute({
      ...(pathless ? { id: path } : { path: routePath }),
      ...options,
      isRoot: false,
    }).update({
      // routeTree.gen re-updates these later; set them here so route files
      // imported without the generated tree still carry their identity
      id: path,
      ...(pathless ? {} : { path: routePath, fullPath: routePath }),
      // any because tanstack router does that
    } as any);
  };
}
