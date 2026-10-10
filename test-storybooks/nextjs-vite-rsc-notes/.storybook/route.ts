import { expect, waitFor } from "storybook/test";

/**
 * Waits for the page of another route, which Next's router loads after a link
 * or a Server Action that redirects. `storybook dev` compiles the modules of a
 * route the first time a page of it loads, which can take longer than a query
 * of Testing Library waits, on a busy machine. The URL is that of the route
 * once its page is there.
 */
export async function routeLoaded(pathname: string | RegExp): Promise<void> {
  await waitFor(
    () =>
      typeof pathname === "string"
        ? expect(window.location.pathname).toBe(pathname)
        : expect(window.location.pathname).toMatch(pathname),
    { timeout: 10_000 },
  );
}
