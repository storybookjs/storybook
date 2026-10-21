import { DEFAULT_MCP_ENDPOINT } from '../constants.ts';

/**
 * Derives the Storybook root from the MCP request path.
 *
 * A Storybook served under a sub-path answers MCP at `<root><endpoint>`, so links into the UI have
 * to be built from the request's own path rather than the bare origin.
 */
function storybookRootFromRequest(
  request: Request | undefined,
  trustedOrigin: string,
  endpoint: string
): string | undefined {
  if (!request?.url) {
    return undefined;
  }
  try {
    const url = new URL(request.url);
    const normalizedEndpoint = endpoint.replace(/\/$/, '');
    const normalizedPathname = url.pathname.replace(/\/$/, '');
    const rootPath = normalizedPathname.endsWith(normalizedEndpoint)
      ? normalizedPathname.slice(0, -normalizedEndpoint.length)
      : normalizedPathname.replace(/\/[^/]+$/, '');
    return `${trustedOrigin.replace(/\/$/, '')}${rootPath}`;
  } catch {
    return undefined;
  }
}

/**
 * Derives the complete Storybook UI base URL for the toolset context, including any deployment
 * subpath. The trusted origin remains separate in the transport context for security checks.
 *
 * A configured base path wins over the request path, because a host that mounts Storybook under
 * that path strips it before the request reaches the MCP handler.
 */
export function resolveToolsetOrigin(context: {
  origin?: string;
  baseUrl?: string;
  request?: Request;
  endpoint?: string;
}): string | undefined {
  if (!context.origin) {
    return undefined;
  }
  if (context.baseUrl && context.baseUrl !== context.origin) {
    return context.baseUrl;
  }
  return context.request
    ? (storybookRootFromRequest(
        context.request,
        context.origin,
        context.endpoint ?? DEFAULT_MCP_ENDPOINT
      ) ?? context.origin)
    : context.origin;
}
