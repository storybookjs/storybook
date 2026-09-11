import React from 'react';
import { fn } from 'storybook/test';
import type { createServerFn as _createServerFn } from '@tanstack/start-client-core';
import { onNavigate } from './spies.ts';

export * from '@tanstack/start-client-core';
export * from '@tanstack/react-start';

const START_SERVER_STATE_SYMBOL = Symbol.for('storybook.tanstack-react.start-server.state');

type RequestOptions<TRegister = unknown> = {
  context?: TRegister extends { server: { requestContext: infer TRequestContext } }
    ? TRequestContext
    : unknown;
};

type MockRequestExecutor<TRegister = unknown> = (
  request: Request,
  opts?: RequestOptions<TRegister>
) => Promise<unknown> | unknown;

type HandlerContext = {
  request: Request;
  responseHeaders: Headers;
  router?: unknown;
  context?: unknown;
  requestContext?: unknown;
};

type HandlerCallback<TRouter = unknown> = (
  context: HandlerContext & { router?: TRouter }
) => Promise<unknown> | unknown;

type SessionConfig = Record<string, unknown>;

type MockSession<TSessionData extends Record<string, unknown> = Record<string, unknown>> = {
  data: Partial<TSessionData>;
  update: (
    update?: Partial<TSessionData> | ((prev: Partial<TSessionData>) => Partial<TSessionData>)
  ) => Promise<MockSession<TSessionData>>;
  save: () => Promise<void>;
  clear: () => Promise<void>;
};

type MockServerState = {
  request: Request;
  responseHeaders: Headers;
  responseStatus?: {
    code?: number;
    text?: string;
  };
  cookies: Map<string, string>;
  sessionData: Record<string, unknown>;
};

type BrowserStartGlobals = typeof globalThis & {
  __TSR_ROUTER__?: unknown;
  [START_SERVER_STATE_SYMBOL]?: MockServerState;
};

const browserGlobals = globalThis as BrowserStartGlobals;

export const HEADERS = {
  TSS_SHELL: 'X-TSS_SHELL',
} as const;

export const VIRTUAL_MODULES = {
  startManifest: 'tanstack-start-manifest:v',
  injectedHeadScripts: 'tanstack-start-injected-head-scripts:v',
  serverFnResolver: '#tanstack-start-server-fn-resolver',
} as const;

function createNamedMock<T extends (...args: Array<any>) => any>(
  name: string,
  implementation: T
): T {
  return fn(implementation).mockName(`@tanstack/react-start/server::${name}`) as unknown as T;
}

function createDefaultRequest() {
  return new Request('http://localhost/');
}

function parseCookieHeader(cookieHeader: string | null) {
  const cookies = new Map<string, string>();

  if (!cookieHeader) {
    return cookies;
  }

  for (const segment of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = segment.trim().split('=');

    if (!rawName) {
      continue;
    }

    cookies.set(rawName, decodeURIComponent(rawValue.join('=')));
  }

  return cookies;
}

function serializeCookie(name: string, value: string, options?: Record<string, unknown>) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (typeof options?.path === 'string') {
    parts.push(`Path=${options.path}`);
  }

  if (typeof options?.domain === 'string') {
    parts.push(`Domain=${options.domain}`);
  }

  if (typeof options?.maxAge === 'number') {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options?.expires instanceof Date) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (options?.httpOnly) {
    parts.push('HttpOnly');
  }

  if (options?.secure) {
    parts.push('Secure');
  }

  if (typeof options?.sameSite === 'string') {
    parts.push(`SameSite=${options.sameSite}`);
  }

  return parts.join('; ');
}

function createMockState(request = createDefaultRequest()): MockServerState {
  return {
    request,
    responseHeaders: new Headers(),
    responseStatus: undefined,
    cookies: parseCookieHeader(request.headers.get('cookie')),
    sessionData: {},
  };
}

function getState() {
  const existingState = browserGlobals[START_SERVER_STATE_SYMBOL];

  if (existingState) {
    return existingState;
  }

  const nextState = createMockState();
  browserGlobals[START_SERVER_STATE_SYMBOL] = nextState;
  return nextState;
}

async function withRequestState<T>(request: Request, run: () => Promise<T> | T) {
  const previousState = browserGlobals[START_SERVER_STATE_SYMBOL];
  browserGlobals[START_SERVER_STATE_SYMBOL] = createMockState(request);

  try {
    return await run();
  } finally {
    if (previousState) {
      browserGlobals[START_SERVER_STATE_SYMBOL] = previousState;
    } else {
      delete browserGlobals[START_SERVER_STATE_SYMBOL];
    }
  }
}

function mergeResponseState(response: Response) {
  const state = getState();
  const headers = new Headers(response.headers);

  state.responseHeaders.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      headers.append(key, value);
      return;
    }

    headers.set(key, value);
  });

  return new Response(response.body, {
    status: state.responseStatus?.code ?? response.status,
    statusText: state.responseStatus?.text ?? response.statusText,
    headers,
  });
}

function toResponse(result: unknown) {
  if (result instanceof Response) {
    return mergeResponseState(result);
  }

  if (result === undefined || result === null) {
    return mergeResponseState(new Response(null));
  }

  if (typeof result === 'string') {
    return mergeResponseState(new Response(result));
  }

  return mergeResponseState(
    new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json' },
    })
  );
}

function getSessionRecord<
  TSessionData extends Record<string, unknown> = Record<string, unknown>,
>(): MockSession<TSessionData> {
  const state = getState();

  return {
    data: state.sessionData as Partial<TSessionData>,
    update: async (
      update?: Partial<TSessionData> | ((prev: Partial<TSessionData>) => Partial<TSessionData>)
    ) => {
      const nextValue =
        typeof update === 'function' ? update(state.sessionData as Partial<TSessionData>) : update;

      state.sessionData = {
        ...state.sessionData,
        ...nextValue,
      };

      return getSessionRecord<TSessionData>();
    },
    save: async () => {},
    clear: async () => {
      state.sessionData = {};
    },
  } satisfies MockSession<TSessionData>;
}

export function StartServer() {
  return null;
}

export const defineHandlerCallback = createNamedMock(
  'defineHandlerCallback',
  <TRouter = unknown>(handler: HandlerCallback<TRouter>) => handler
);

export const defaultStreamHandler = createNamedMock(
  'defaultStreamHandler',
  async () => new Response('Storybook Mock', { status: 200 })
);

export const defaultRenderHandler = createNamedMock(
  'defaultRenderHandler',
  async () => new Response('Storybook Mock', { status: 200 })
);

export const requestHandler = createNamedMock(
  'requestHandler',
  <TRegister = unknown>(handler: MockRequestExecutor<TRegister>) => {
    return async (request: Request, requestOpts?: RequestOptions<TRegister>) =>
      withRequestState(request, async () => toResponse(await handler(request, requestOpts)));
  }
);

export const createRequestHandler = createNamedMock(
  'createRequestHandler',
  <TRegister = unknown>(handler: MockRequestExecutor<TRegister>) => requestHandler(handler)
);

export const createStartHandler = createNamedMock(
  'createStartHandler',
  <TRegister = unknown>(
    cbOrOptions:
      | HandlerCallback
      | {
          handler?: HandlerCallback;
        }
  ) => {
    const handler = typeof cbOrOptions === 'function' ? cbOrOptions : cbOrOptions?.handler;

    return requestHandler<TRegister>(async (request, requestOpts) => {
      if (!handler) {
        return new Response('Storybook Mock', { status: 200 });
      }

      return handler({
        request,
        responseHeaders: getState().responseHeaders,
        router: browserGlobals.__TSR_ROUTER__,
        context: requestOpts?.context,
        requestContext: requestOpts?.context,
      });
    });
  }
);

export const attachRouterServerSsrUtils = createNamedMock(
  'attachRouterServerSsrUtils',
  <TRouter>(router: TRouter) => router
);

export const transformReadableStreamWithRouter = createNamedMock(
  'transformReadableStreamWithRouter',
  <TReadableStream>(stream: TReadableStream) => stream
);

export const transformPipeableStreamWithRouter = createNamedMock(
  'transformPipeableStreamWithRouter',
  <TPipeableStream>(stream: TPipeableStream) => stream
);

export const getRequest = createNamedMock('getRequest', () => getState().request);

export const getRequestHeaders = createNamedMock(
  'getRequestHeaders',
  () => getState().request.headers
);

export const getRequestHeader = createNamedMock('getRequestHeader', (name: string) => {
  return getState().request.headers.get(name) ?? undefined;
});

export const getRequestIP = createNamedMock(
  'getRequestIP',
  (opts?: { xForwardedFor?: boolean }) => {
    if (!opts?.xForwardedFor) {
      return undefined;
    }

    return getRequestHeader('x-forwarded-for')?.split(',')[0]?.trim();
  }
);

export const getRequestHost = createNamedMock(
  'getRequestHost',
  (opts?: { xForwardedHost?: boolean }) => {
    const host = opts?.xForwardedHost
      ? getRequestHeader('x-forwarded-host')
      : getRequestHeader('host');

    return host ?? new URL(getState().request.url).host ?? 'localhost';
  }
);

export const getRequestUrl = createNamedMock(
  'getRequestUrl',
  (opts?: { xForwardedHost?: boolean; xForwardedProto?: boolean }) => {
    const url = new URL(getState().request.url);
    const forwardedHost = opts?.xForwardedHost ? getRequestHeader('x-forwarded-host') : undefined;
    const forwardedProto =
      opts?.xForwardedProto === false ? undefined : getRequestHeader('x-forwarded-proto');

    if (forwardedHost) {
      url.host = forwardedHost;
    }

    if (forwardedProto) {
      url.protocol = `${forwardedProto}:`;
    }

    return url;
  }
);

export const getRequestProtocol = createNamedMock(
  'getRequestProtocol',
  (opts?: { xForwardedProto?: boolean }) => {
    const forwardedProto =
      opts?.xForwardedProto === false ? undefined : getRequestHeader('x-forwarded-proto');

    if (forwardedProto) {
      return forwardedProto;
    }

    return getRequestUrl().protocol.replace(/:$/, '') || 'http';
  }
);

export const setResponseHeaders = createNamedMock('setResponseHeaders', (headers: HeadersInit) => {
  getState().responseHeaders = new Headers(headers);
});

export const getResponseHeaders = createNamedMock(
  'getResponseHeaders',
  () => getState().responseHeaders
);

export const getResponseHeader = createNamedMock('getResponseHeader', (name: string) => {
  return getState().responseHeaders.get(name) ?? undefined;
});

export const setResponseHeader = createNamedMock(
  'setResponseHeader',
  (name: string, value: string | Array<string>) => {
    const headers = getState().responseHeaders;
    headers.delete(name);

    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(name, entry));
      return;
    }

    headers.set(name, value);
  }
);

export const removeResponseHeader = createNamedMock('removeResponseHeader', (name: string) => {
  getState().responseHeaders.delete(name);
});

export const clearResponseHeaders = createNamedMock(
  'clearResponseHeaders',
  (headerNames?: Array<string>) => {
    if (!headerNames?.length) {
      getState().responseHeaders = new Headers();
      return;
    }

    headerNames.forEach((name) => getState().responseHeaders.delete(name));
  }
);

export const getResponseStatus = createNamedMock('getResponseStatus', () => {
  return getState().responseStatus?.code ?? 200;
});

export const setResponseStatus = createNamedMock(
  'setResponseStatus',
  (code?: number, text?: string) => {
    getState().responseStatus = {
      code,
      text,
    };
  }
);

export const getCookies = createNamedMock('getCookies', () => {
  return Object.fromEntries(getState().cookies);
});

export const getCookie = createNamedMock('getCookie', (name: string) => {
  return getState().cookies.get(name);
});

export const setCookie = createNamedMock(
  'setCookie',
  (name: string, value: string, options?: Record<string, unknown>) => {
    const state = getState();
    state.cookies.set(name, value);
    state.responseHeaders.append('set-cookie', serializeCookie(name, value, options));
  }
);

export const deleteCookie = createNamedMock(
  'deleteCookie',
  (name: string, options?: Record<string, unknown>) => {
    const state = getState();
    state.cookies.delete(name);
    state.responseHeaders.append(
      'set-cookie',
      serializeCookie(name, '', {
        ...options,
        maxAge: 0,
      })
    );
  }
);

export const useSession = createNamedMock(
  'useSession',
  async <TSessionData extends Record<string, unknown> = Record<string, unknown>>(
    _config: SessionConfig
  ) => getSessionRecord<TSessionData>()
);

export const getSession = createNamedMock(
  'getSession',
  async <TSessionData extends Record<string, unknown> = Record<string, unknown>>(
    _config: SessionConfig
  ) => getSessionRecord<TSessionData>()
);

export const updateSession = createNamedMock(
  'updateSession',
  async <TSessionData extends Record<string, unknown> = Record<string, unknown>>(
    _config: SessionConfig,
    update?: Partial<TSessionData> | ((prev: Partial<TSessionData>) => Partial<TSessionData>)
  ) => getSessionRecord<TSessionData>().update(update)
);

export const sealSession = createNamedMock('sealSession', async (_config: SessionConfig) => {
  return JSON.stringify(getState().sessionData);
});

export const unsealSession = createNamedMock(
  'unsealSession',
  async (_config: SessionConfig, sealed: string) => {
    try {
      return JSON.parse(sealed);
    } catch {
      return {};
    }
  }
);

export const clearSession = createNamedMock(
  'clearSession',
  async (_config: Partial<SessionConfig>) => {
    getState().sessionData = {};
  }
);

export const getResponse = createNamedMock('getResponse', () => {
  return {
    status: getState().responseStatus?.code,
    statusText: getState().responseStatus?.text,
    get headers() {
      return getState().responseHeaders;
    },
  };
});

export const getValidatedQuery = createNamedMock(
  'getValidatedQuery',
  async (schema: {
    parse?: (value: Record<string, string>) => unknown;
    safeParse?: (value: Record<string, string>) => unknown;
    ['~standard']?: {
      validate?: (value: Record<string, string>) => Promise<unknown> | unknown;
    };
  }) => {
    const query = Object.fromEntries(getRequestUrl().searchParams.entries());

    if (typeof schema?.parse === 'function') {
      return schema.parse(query);
    }

    if (typeof schema?.safeParse === 'function') {
      const result = await schema.safeParse(query);

      if (result && typeof result === 'object' && 'data' in result) {
        return (result as { data: unknown }).data;
      }

      return result;
    }

    if (typeof schema?.['~standard']?.validate === 'function') {
      return schema['~standard'].validate(query);
    }

    return query;
  }
);

// ============================================================================
// Client-side APIs (from @tanstack/react-start and @tanstack/start-client-core)
// ============================================================================

export function useServerFn<T extends (...args: Array<any>) => Promise<any>>(
  serverFn: T
): (...args: Parameters<T>) => ReturnType<T> {
  return React.useCallback(
    (...args: Parameters<T>) => serverFn(...args) as ReturnType<T>,
    [serverFn]
  );
}

function createMockServerFnBuilder(): any {
  const builder = () => createMockServerFnBuilder();

  let _storedOptions: any;

  builder.options = (opts?: any) => {
    _storedOptions = opts;
    return builder;
  };

  builder.middleware = () => {
    return createMockServerFnBuilder();
  };

  builder.inputValidator = () => {
    return createMockServerFnBuilder();
  };

  builder.validator = () => {
    return createMockServerFnBuilder();
  };

  builder.handler = (handlerFn?: (...args: any[]) => any) => {
    const mock = fn().mockName('@tanstack/start-client-core::createServerFn.handler()');

    if (handlerFn) {
      mock.mockImplementation(async (opts?: any) => handlerFn(opts));
    }

    return mock;
  };

  (builder as any)._getOptions = () => _storedOptions;

  return builder;
}

// Override `createServerFn` from start-client-core with our mock version
export const createServerFn: typeof _createServerFn = (options?: any) => {
  const builder = createMockServerFnBuilder();
  if (options !== undefined) {
    builder.options(options);
  }
  return builder;
};

export const Link = ({
  to,
  children,
  ...props
}: {
  to: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}) => React.createElement('a', { href: to, ...props }, children);

export const Navigate = ({ to }: { to: string }) => {
  React.useEffect(() => {
    onNavigate({ to });
  }, [to]);

  return null;
};

export const Hydrate = ({ children }: { children?: React.ReactNode; [key: string]: unknown }) =>
  children ?? null;

export const notFound = () => {
  throw new Error('Not found');
};

// TanStack Start server entry
export const createStart = () => ({});

// Cookie helpers (client-side simple storage)
const clientCookieStore = new Map<string, string>();

export const clearCookieStore = () => {
  clientCookieStore.clear();
};

// Server entry default export
const fetchHandler = async () => new Response('Storybook Mock', { status: 200 });

export { fetchHandler as fetch };

export default { fetch: fetchHandler };
