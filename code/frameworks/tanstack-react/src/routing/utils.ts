import { Route, RootRoute } from '@tanstack/react-router';

export function isRoute(value: unknown): value is InstanceType<typeof Route> {
  return value instanceof Route || value instanceof RootRoute;
}
