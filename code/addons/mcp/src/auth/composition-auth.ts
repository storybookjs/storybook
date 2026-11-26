/**
 * Composition authentication for fetching manifests from private Storybooks.
 *
 * This class handles OAuth discovery and token-based manifest fetching for
 * composed Storybooks (refs). It acts as a proxy for OAuth metadata, allowing
 * MCP clients like VS Code to handle the OAuth flow with Chromatic.
 */

import {
  ComponentManifestMap,
  DocsManifestMap,
  REF_MANIFEST_FETCH_TIMEOUT_MS,
  type Source,
} from 'storybook/internal/toolsets-docs';
import { logger } from 'storybook/internal/node-logger';
import * as v from 'valibot';

export interface ComposedRef {
  id: string;
  title: string;
  url: string;
}

const OAuthResourceMetadata = v.object({
  resource: v.optional(v.string()),
  authorization_servers: v.pipe(v.array(v.string()), v.minLength(1)),
  scopes_supported: v.optional(v.array(v.string())),
});
export type OAuthResourceMetadata = v.InferOutput<typeof OAuthResourceMetadata>;

const OAuthServerMetadata = v.object({
  issuer: v.string(),
  authorization_endpoint: v.string(),
  token_endpoint: v.string(),
  scopes_supported: v.optional(v.array(v.string())),
});
export type OAuthServerMetadata = v.InferOutput<typeof OAuthServerMetadata>;

interface AuthRequirement {
  resourceMetadataUrl: string;
  resourceMetadata: OAuthResourceMetadata;
  serverMetadata: OAuthServerMetadata;
}

type NoManifestReason = 'manifest-not-found' | 'manifest-invalid';
type RefCheckResult = 'public' | NoManifestReason | AuthRequirement;

// Only `unreachable` is checked again; the other states take a restart to change.
type RefStatus =
  | { kind: 'public' }
  | { kind: 'auth'; requirement: AuthRequirement }
  | { kind: 'excluded' }
  | { kind: 'unreachable'; failures: number; retryAt: number };

interface RefState {
  ref: ComposedRef;
  status: RefStatus;
  // The check in flight, shared by concurrent readers
  check?: Promise<void>;
}

const RECHECK_BASE_DELAY = 5 * 1000;
const RECHECK_MAX_DELAY = 60 * 1000;
// How long a read of an unreachable ref waits for its re-check
const RECHECK_WAIT = 3 * 1000;

// 501 is how some static hosts answer the POST to /mcp.
const isTransientStatus = (status: number) =>
  status === 408 || status === 429 || (status >= 500 && status !== 501);

const fetchRef = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(REF_MANIFEST_FETCH_TIMEOUT_MS) });

/** Fetches for a ref check, throwing on a transient status so the ref is checked again. */
const probeRef = async (url: string, init?: RequestInit) => {
  const response = await fetchRef(url, init);
  if (isTransientStatus(response.status)) {
    throw new Error(`${url} responded with ${response.status}`);
  }
  return response;
};

export type ManifestProvider = (
  request: Request | undefined,
  path: string,
  source?: Source
) => Promise<string>;
type RemoteSource = Source & { url: string };

const MANIFEST_CACHE_TTL = 60 * 60 * 1000; // 60 minutes
const REVALIDATION_TTL = 60 * 1000; // 60 seconds

interface CacheEntry {
  text: string;
  timestamp: number;
  lastRevalidatedAt?: number;
}

export class AuthenticationError extends Error {
  constructor(url: string) {
    super(`Authentication failed for ${url}. Your token may be invalid or expired.`);
    this.name = 'AuthenticationError';
  }
}

export class CompositionAuth {
  #refStates: RefState[] = [];
  #manifestCache = new Map<string, CacheEntry>();
  #lastToken: string | null = null;
  #authErrors = new WeakMap<Request, AuthenticationError>();

  /** Initialize by checking which refs require authentication and have manifests. */
  async initialize(refs: ComposedRef[]): Promise<void> {
    this.#refStates = refs.map((ref) => ({
      ref,
      status: { kind: 'unreachable', failures: 0, retryAt: 0 },
    }));
    await Promise.all(this.#refStates.map((state) => this.#recheckIfDue(state)));
  }

  // Never rejects
  #check(state: RefState): Promise<void> {
    state.check ??= this.#checkRef(state.ref.url)
      .then(
        (result) => this.#applyResult(state, result),
        (error) => this.#applyFailure(state, error)
      )
      .catch((error) => {
        logger.warn(
          `[addon-mcp] Checking composed ref "${state.ref.title}" failed: ${error instanceof Error ? error.message : String(error)}`
        );
      })
      .finally(() => {
        state.check = undefined;
      });
    return state.check;
  }

  /** Re-checks an unreachable ref that is due, waiting at most `RECHECK_WAIT` for it. */
  async #recheckIfDue(state: RefState): Promise<void> {
    const { status } = state;
    if (status.kind !== 'unreachable' || status.retryAt > Date.now()) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      this.#check(state),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, RECHECK_WAIT);
      }),
    ]);
    clearTimeout(timer);
  }

  #applyFailure(state: RefState, error: unknown): void {
    const { ref, status } = state;
    const failures = status.kind === 'unreachable' ? status.failures + 1 : 1;
    const delay = Math.min(RECHECK_BASE_DELAY * 2 ** (failures - 1), RECHECK_MAX_DELAY);
    state.status = { kind: 'unreachable', failures, retryAt: Date.now() + delay };
    if (failures === 1) {
      logger.warn(
        `[addon-mcp] Composed ref "${ref.title}" (${ref.url}) could not be reached (${error instanceof Error ? error.message : String(error)}). It is checked again when MCP next reads it.`
      );
    }
  }

  #applyResult(state: RefState, result: RefCheckResult): void {
    const { ref } = state;
    const previous = state.status;
    if (previous.kind === 'unreachable' && previous.failures > 0) {
      logger.info(`[addon-mcp] Composed ref "${ref.title}" (${ref.url}) is reachable again.`);
    }

    if (result === 'manifest-not-found') {
      state.status = { kind: 'excluded' };
      logger.warn(
        `[addon-mcp] Skipping composed ref "${ref.title}" (${ref.url}): components manifest not found at ${ref.url}/manifests/components.json. Enable the \`componentsManifest\` feature on that Storybook to compose it into MCP.`
      );
      return;
    }
    if (result === 'manifest-invalid') {
      state.status = { kind: 'excluded' };
      logger.warn(
        `[addon-mcp] Skipping composed ref "${ref.title}" (${ref.url}): its components manifest failed validation. This usually means a version mismatch between the composed Storybook and this one — upgrade the older side.`
      );
      return;
    }
    if (result === 'public') {
      state.status = { kind: 'public' };
      return;
    }

    const previousFirst = this.#authStates()[0];
    state.status = { kind: 'auth', requirement: result };
    const [first] = this.#authStates();
    // Warns once about the ref whose server is not, or is no longer, the advertised one
    const other = first.ref === ref ? previousFirst : { ref, requirement: result };
    const advertised = first.requirement.resourceMetadata.authorization_servers[0];
    const server = other?.requirement.resourceMetadata.authorization_servers[0];
    if (other && server !== advertised) {
      logger.warn(
        `[addon-mcp] Composed ref "${other.ref.title}" uses a different OAuth server (${server}) than the first authenticated ref (${advertised}). Only the first OAuth server will be used for authentication.`
      );
    }
  }

  #authStates() {
    return this.#refStates.flatMap(({ ref, status }) =>
      status.kind === 'auth' ? [{ ref, requirement: status.requirement }] : []
    );
  }

  get requiresAuth(): boolean {
    return this.authUrls.length > 0;
  }

  get authUrls(): string[] {
    return this.#authStates().map(({ ref }) => ref.url);
  }

  /** Check if a request encountered an auth error during manifest fetching. */
  hadAuthError(request: Request): boolean {
    return this.#authErrors.has(request);
  }

  /**
   * Build .well-known/oauth-protected-resource response for the MCP endpoint at `resource`. The
   * first private ref in config order decides the OAuth server.
   */
  buildWellKnown(resource: string): object | null {
    const [first] = this.#authStates();
    if (!first) return null;
    const { authorization_servers, scopes_supported } = first.requirement.resourceMetadata;
    return { resource, authorization_servers, scopes_supported };
  }

  /** Build WWW-Authenticate header for 401 responses */
  buildWwwAuthenticate(baseUrl: string): string {
    return `Bearer error="unauthorized", error_description="Authorization needed for composed Storybooks", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`;
  }

  /** Build sources configuration: local first, then every ref that is not excluded. */
  buildSources(): Source[] {
    return [
      { id: 'local', title: 'Local' },
      ...this.#refStates
        .filter(({ status }) => status.kind !== 'excluded')
        .map(({ ref }) => ({
          id: ref.id,
          title: ref.title,
          url: ref.url,
        })),
    ];
  }

  /**
   * Create a manifest provider for multi-source mode.
   *
   * Remote sources are fetched over HTTP with auth and caching; the local source fetches from
   * `localBaseUrl`. In `docgenServer` mode core 404s the local `/manifests/*.json`, and
   * the composition reads that source through its own access instead of this provider.
   */
  createManifestProvider(localBaseUrl: string): ManifestProvider {
    return async (request, path, source) => {
      const token = extractBearerToken(request?.headers.get('Authorization'));
      const remoteSource: RemoteSource | undefined = source?.url
        ? { ...source, url: source.url }
        : undefined;

      const state = remoteSource && this.#refStates.find(({ ref }) => ref.url === remoteSource.url);
      if (state) await this.#recheckIfDue(state);
      if (state?.status.kind === 'unreachable') {
        throw new Error(
          `"${state.ref.title}" is temporarily unreachable. It is checked again when MCP next reads it.`
        );
      }
      if (state?.status.kind === 'excluded') {
        throw new Error(`"${state.ref.title}" has no usable components manifest.`);
      }

      const baseUrl = remoteSource?.url ?? localBaseUrl;
      const manifestUrl = `${baseUrl}${path.replace(/^\.\//, '/')}`;
      const isRemote = !!remoteSource;
      const needsAuth = state?.status.kind === 'auth';
      const tokenForRequest = needsAuth ? token : null;

      // New token = user re-authenticated, invalidate all cached manifests
      if (token && token !== this.#lastToken) {
        this.#manifestCache.clear();
        this.#lastToken = token;
      }

      if (isRemote) {
        const cached = this.#manifestCache.get(manifestUrl);
        if (cached) {
          const age = Date.now() - cached.timestamp;
          if (age > MANIFEST_CACHE_TTL) {
            // Expired — discard cache, fetch fresh below
            this.#manifestCache.delete(manifestUrl);
          } else {
            // Fresh — serve cached, revalidate in background (at most once per 60s)
            const shouldRevalidate =
              !cached.lastRevalidatedAt || Date.now() - cached.lastRevalidatedAt > REVALIDATION_TTL;
            if (shouldRevalidate) {
              cached.lastRevalidatedAt = Date.now();
              void this.#fetchManifest(manifestUrl, tokenForRequest)
                .then((text) =>
                  this.#manifestCache.set(manifestUrl, {
                    text,
                    timestamp: Date.now(),
                    lastRevalidatedAt: Date.now(),
                  })
                )
                .catch(() => {});
            }
            return cached.text;
          }
        }
      }

      try {
        const text = await this.#fetchManifest(manifestUrl, tokenForRequest);

        if (isRemote) {
          this.#manifestCache.set(manifestUrl, { text, timestamp: Date.now() });
        }

        return text;
      } catch (error) {
        if (error instanceof AuthenticationError && request) {
          this.#authErrors.set(request, error);
        }
        throw error;
      }
    };
  }

  /**
   * Fetch a manifest with optional auth token.
   * If the response is 200 but not a valid manifest, checks /mcp for auth issues.
   */
  async #fetchManifest(url: string, token: string | null): Promise<string> {
    const headers: HeadersInit = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetchRef(url, { headers });

    if (response.status === 401) {
      throw new AuthenticationError(url);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const text = await response.text();

    // Only the top-level manifest paths are sanity-checked against their schemas.
    // Split/ref service payloads (e.g. `.../services/addon-docs/mdx/<id>--docs.json`)
    // must not be matched here, so use an exact pathname check rather than a substring.
    const { pathname } = new URL(url);
    const isComponentsManifest = pathname.endsWith('/manifests/components.json');
    const isDocsManifest = pathname.endsWith('/manifests/docs.json');
    const schema = isComponentsManifest
      ? ComponentManifestMap
      : isDocsManifest
        ? DocsManifestMap
        : v.unknown();

    if (v.safeParse(v.pipe(v.string(), v.parseJson(), schema), text).success) {
      return text;
    }

    // Invalid response — check /mcp to see if it's an auth issue
    if (await this.#isMcpUnauthorized(new URL(url).origin)) {
      throw new AuthenticationError(url);
    }

    throw new Error(
      `Invalid manifest response from ${url}: expected valid JSON manifest but got unexpected content.`
    );
  }

  /**
   * Check a ref to determine if it has a manifest and whether it requires auth.
   * Returns 'public' if the ref has a valid manifest without auth,
   * an AuthRequirement if auth is needed, or the reason the ref has no usable manifest:
   * 'manifest-not-found' for a non-OK or non-JSON response (SPA fallback pages land here),
   * 'manifest-invalid' for real JSON that fails the manifest schema.
   */
  async #checkRef(refUrl: string): Promise<RefCheckResult> {
    const manifestUrl = `${refUrl}/manifests/components.json`;
    const response = await probeRef(manifestUrl, { headers: { Accept: 'application/json' } });

    // 401 with WWW-Authenticate = auth needed
    const authReq = await this.#parseAuthFromResponse(response);
    if (authReq) return authReq;

    let noManifestReason: NoManifestReason = 'manifest-not-found';

    // 200 with valid manifest = public, has manifest
    if (response.ok) {
      const text = await response.text();
      const json = v.safeParse(v.pipe(v.string(), v.parseJson()), text);
      if (json.success) {
        if (v.safeParse(ComponentManifestMap, json.output).success) {
          return 'public';
        }
        noManifestReason = 'manifest-invalid';
      }
    }

    // Unexpected response — fall back to /mcp
    const mcpAuth = await this.#checkMcpAuth(refUrl);
    if (mcpAuth) return mcpAuth;

    return noManifestReason;
  }

  /** Check /mcp endpoint for 401 auth requirement. */
  async #checkMcpAuth(refUrl: string): Promise<AuthRequirement | null> {
    const response = await probeRef(`${refUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    return this.#parseAuthFromResponse(response);
  }

  /** Quick check: does the remote /mcp return 401? */
  async #isMcpUnauthorized(origin: string): Promise<boolean> {
    try {
      const response = await fetchRef(`${origin}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      return response.status === 401;
    } catch {
      return false;
    }
  }

  /** Extract auth requirement from a 401 response's WWW-Authenticate header. */
  async #parseAuthFromResponse(response: Response): Promise<AuthRequirement | null> {
    if (response.status !== 401) return null;
    const wwwAuth = response.headers.get('WWW-Authenticate');
    if (!wwwAuth) return null;

    const match = wwwAuth.match(/resource_metadata="([^"]+)"/);
    if (!match?.[1]) return null;

    const resourceMetadataUrl = match[1];
    const resourceResponse = await probeRef(resourceMetadataUrl);
    if (!resourceResponse.ok) {
      logger.warn(
        `[addon-mcp] Failed to fetch OAuth resource metadata from ${resourceMetadataUrl}: ${resourceResponse.status}`
      );
      return null;
    }
    const resourceResult = v.safeParse(OAuthResourceMetadata, await resourceResponse.json());
    if (!resourceResult.success) {
      logger.warn(
        `[addon-mcp] Invalid OAuth resource metadata from ${resourceMetadataUrl}: ${resourceResult.issues.map((i) => i.message).join(', ')}`
      );
      return null;
    }

    const authServer = resourceResult.output.authorization_servers[0];
    const serverMetadataUrl = `${authServer}/.well-known/oauth-authorization-server`;
    const serverResponse = await probeRef(serverMetadataUrl);
    if (!serverResponse.ok) {
      logger.warn(
        `[addon-mcp] Failed to fetch OAuth server metadata from ${serverMetadataUrl}: ${serverResponse.status}`
      );
      return null;
    }

    const serverResult = v.safeParse(OAuthServerMetadata, await serverResponse.json());
    if (!serverResult.success) {
      logger.warn(
        `[addon-mcp] Invalid OAuth server metadata from ${serverMetadataUrl}: ${serverResult.issues.map((i) => i.message).join(', ')}`
      );
      return null;
    }

    return {
      resourceMetadataUrl,
      resourceMetadata: resourceResult.output,
      serverMetadata: serverResult.output,
    };
  }
}

/**
 * Extract Bearer token from Authorization header.
 * Handles both Node.js (string | string[] | undefined) and Web API (string | null) headers.
 */
export function extractBearerToken(
  authHeader: string | string[] | null | undefined
): string | null {
  const values = Array.isArray(authHeader) ? authHeader : [authHeader];
  const bearer = values.find((value) => typeof value === 'string' && value.startsWith('Bearer '));
  return bearer ? bearer.slice(7) : null;
}
