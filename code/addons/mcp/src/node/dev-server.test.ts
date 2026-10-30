import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getToolAvailability } from 'storybook/internal/server';
import { mountMcpServer as mount } from './dev-server.ts';
import * as mcpHandlerModule from '../mcp-handler.ts';
import { useTestInstance } from '../../../../core/src/shared/instance-context.test-helpers.ts';
import { registerCoreToolsetsForTest } from '../test-support/register-core-toolsets.ts';
import type { AddonOptionsInput, McpStorybook } from '../types.ts';

// Tests force one availability gate at this core seam.
vi.mock('storybook/internal/server', { spy: true });

/** The Storybook a test mounts the MCP server on, plus the addon options. */
type MountSetup = AddonOptionsInput & {
  /** Hook results by hook name; a function is called for its result. */
  hooks?: Record<string, unknown>;
  /** The resolved `core` config. */
  core?: Record<string, unknown>;
};

/** A Storybook whose hooks resolve to `hooks[name]`, falling back to the passed value. */
function createStorybook({ hooks = {}, core }: MountSetup = {}) {
  return {
    options: { port: 6006 },
    configDir: '/project/.storybook',
    callHook: vi.fn(async (name: string, value?: unknown) => {
      if (name === 'core:config:extend') {
        return core ?? value;
      }
      const result = name in hooks ? hooks[name] : value;
      return typeof result === 'function' ? result() : result;
    }),
    hasAddon: () => false,
    getIndex: vi.fn(),
    getStoryIndexGenerator: vi.fn(),
  } satisfies Record<keyof McpStorybook, unknown>;
}

const mountMcpServer = (app: unknown, setup: MountSetup) =>
  mount(app as never, createStorybook(setup) as unknown as McpStorybook, {
    endpoint: setup.endpoint,
    toolsets: setup.toolsets,
  });

describe('mountMcpServer', () => {
  let mockApp: any;
  let mockOptions: MountSetup;
  let mcpHandler: any;

  useTestInstance();

  beforeEach(() => {
    // The `services` preset hook does this in a real Storybook before the dev server mounts /mcp.
    registerCoreToolsetsForTest();
    vi.restoreAllMocks();

    mockApp = {
      post: vi.fn((path, handler) => {
        mcpHandler = handler;
      }),
      get: vi.fn(),
    };

    mockOptions = { hooks: { 'core:features:extend': { componentsManifest: false } } };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubPrivateRefDiscovery = () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers({
            'WWW-Authenticate':
              'Bearer resource_metadata="https://private.example.com/.well-known/oauth-protected-resource"',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              resource: 'https://private.example.com/mcp',
              authorization_servers: ['https://auth.example.com'],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              issuer: 'https://auth.example.com',
              authorization_endpoint: 'https://auth.example.com/authorize',
              token_endpoint: 'https://auth.example.com/token',
            }),
        })
    );
  };

  const createOptionsWithPrivateRef = (): MountSetup => ({
    hooks: {
      'manager:refs:extend': { private: { title: 'Private', url: 'https://private.example.com' } },
      'core:features:extend': { componentsManifest: false },
    },
  });

  it('should register /mcp POST endpoint', async () => {
    await mountMcpServer(mockApp, mockOptions);

    expect(mockApp.post).toHaveBeenCalledWith('/mcp', expect.any(Function));
    expect(mcpHandler).toBeDefined();
  });

  it('does not register any review-related channel listeners (handled by addon-review preset)', async () => {
    const channel = { on: vi.fn(), emit: vi.fn() };
    const storybookWithChannel = { ...createStorybook(), channel };

    await mount(mockApp, storybookWithChannel as unknown as McpStorybook);

    expect(channel.on).not.toHaveBeenCalled();
  });

  it('should register /mcp GET endpoint', async () => {
    await mountMcpServer(mockApp, mockOptions);

    expect(mockApp.get).toHaveBeenCalledWith('/mcp', expect.any(Function));
  });

  it('should use a configured MCP endpoint for the dev server route', async () => {
    const customOptions = { ...mockOptions, endpoint: '/custom-mcp' };

    await mountMcpServer(mockApp, customOptions);

    expect(mockApp.post).toHaveBeenCalledWith('/custom-mcp', expect.any(Function));
    expect(mockApp.get).toHaveBeenCalledWith('/custom-mcp', expect.any(Function));
  });

  it('should leave manifest fetching on the core default provider for the default endpoint', async () => {
    const handlers: Record<string, any> = {};
    mockApp.get = vi.fn((path: string, handler: any) => {
      handlers[path] = handler;
    });

    const mcpServerHandler = vi
      .spyOn(mcpHandlerModule, 'mcpServerHandler')
      .mockResolvedValue(undefined);

    await mountMcpServer(mockApp, mockOptions);
    await handlers['/mcp'](
      {
        headers: { accept: 'application/json' },
      },
      {}
    );

    expect(mcpServerHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        manifestProvider: undefined,
        sources: undefined,
      })
    );
  });

  it('should leave manifest fetching on the core default provider for a custom endpoint without refs', async () => {
    const handlers: Record<string, any> = {};
    mockApp.get = vi.fn((path: string, handler: any) => {
      handlers[path] = handler;
    });

    const mcpServerHandler = vi
      .spyOn(mcpHandlerModule, 'mcpServerHandler')
      .mockResolvedValue(undefined);

    const customOptions = { ...mockOptions, endpoint: '/custom-mcp' };

    await mountMcpServer(mockApp, customOptions);
    await handlers['/custom-mcp'](
      {
        headers: { accept: 'application/json' },
      },
      {}
    );

    expect(mcpServerHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        addonOptions: expect.objectContaining({
          endpoint: '/custom-mcp',
        }),
        manifestProvider: undefined,
        sources: undefined,
      })
    );
  });

  it('should use localhost manifests for the local source when refs are configured', async () => {
    const handlers: Record<string, any> = {};
    mockApp.get = vi.fn((path: string, handler: any) => {
      handlers[path] = handler;
    });

    const mcpServerHandler = vi
      .spyOn(mcpHandlerModule, 'mcpServerHandler')
      .mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"v":1,"components":{}}'),
    });
    vi.stubGlobal('fetch', fetchMock);

    const optionsWithRefs: MountSetup = {
      endpoint: '/custom-mcp',
      hooks: {
        'manager:refs:extend': {
          'design-system': { title: 'Design System', url: 'https://ds.example.com/storybook' },
        },
        'core:features:extend': { componentsManifest: false },
      },
    };

    await mountMcpServer(mockApp, optionsWithRefs);
    await handlers['/custom-mcp'](
      {
        headers: { accept: 'application/json' },
      },
      {}
    );

    const firstCall = mcpServerHandler.mock.calls[0];
    if (!firstCall) {
      throw new Error('Expected mcpServerHandler to be called');
    }
    const { manifestProvider } = firstCall[0];
    if (!manifestProvider) {
      throw new Error('Expected refs to create a manifest provider');
    }

    await manifestProvider(
      new Request('http://localhost:6006/custom-mcp?transport=sse'),
      './manifests/components.json',
      { id: 'local', title: 'Local' }
    );

    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:6006/manifests/components.json',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      })
    );
  });

  it('should keep direct unauthenticated requests on the OAuth challenge path', async () => {
    const mcpServerHandler = vi
      .spyOn(mcpHandlerModule, 'mcpServerHandler')
      .mockResolvedValue(undefined);
    stubPrivateRefDiscovery();

    await mountMcpServer(mockApp, createOptionsWithPrivateRef());

    const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any;
    await mcpHandler(
      {
        headers: {},
      },
      mockRes
    );

    expect(mockRes.writeHead).toHaveBeenCalledWith(
      401,
      expect.objectContaining({
        'WWW-Authenticate': expect.stringContaining('/.well-known/oauth-protected-resource'),
      })
    );
    expect(mockRes.end).toHaveBeenCalledWith('401 - Unauthorized');
    expect(mcpServerHandler).not.toHaveBeenCalled();
  });

  it('should serve HTML for browser GET requests', async () => {
    let getHandler: any;
    mockApp.get = vi.fn((path, handler) => {
      getHandler = handler;
    });

    await mountMcpServer(mockApp, mockOptions);

    const mockReq = {
      headers: {
        accept: 'text/html',
      },
    } as any;

    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as any;

    await getHandler(mockReq, mockRes);

    expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/html',
    });
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('<html'));
  });

  it('should list the change-detection and review tools in the landing page', async () => {
    let getHandler: any;
    mockApp.get = vi.fn((_path, handler) => {
      getHandler = handler;
    });

    await mountMcpServer(mockApp, mockOptions);

    const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any;
    await getHandler({ headers: { accept: 'text/html' } } as any, mockRes);

    const html = mockRes.end.mock.calls[0][0] as string;
    for (const tool of [
      'stories-find-by-component',
      'stories-changed',
      'review-create',
      'docs-show-story',
    ]) {
      expect(html).toContain(`<code>${tool}</code>`);
    }
    // Every placeholder must be substituted — no `{{...}}` may leak to the page.
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('marks dev tools disabled on the landing page when the dev toolset is turned off', async () => {
    // Module graph IS supported, so `stories-find-by-component` would otherwise badge
    // as enabled — proving the badge now also honors the `dev` toolset being disabled.
    // Everything else here matches what `mockOptions`'s fixture (features: { componentsManifest:
    // false }, no other hooks) would resolve for real; only `moduleGraphSupported` is forced.
    vi.mocked(getToolAvailability).mockResolvedValueOnce({
      moduleGraphSupported: true,
      docsEnabled: false,
      docsEnabledForCli: false,
      docsHasManifests: false,
      docsFeatureEnabled: false,
      testSupported: false,
      a11yEnabled: false,
      docgenServer: false,
    });

    let getHandler: any;
    mockApp.get = vi.fn((_path, handler) => {
      getHandler = handler;
    });

    const devOffOptions = { ...mockOptions, toolsets: { dev: false } };

    await mountMcpServer(mockApp, devOffOptions);

    const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any;
    await getHandler({ headers: { accept: 'text/html' } } as any, mockRes);

    const html = mockRes.end.mock.calls[0][0] as string;

    expect(html).toMatch(
      /<code>stories-find-by-component<\/code>\s*<span class="toolset-status disabled"/
    );
    expect(html).toContain('The <code>dev</code> toolset is disabled via addon options.');
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('names the missing manifest prerequisite instead of claiming the framework is unsupported', async () => {
    // `mockOptions` has no manifests and `componentsManifest: false`, which is what an
    // Angular-vite or Vue project that only forgot a feature flag looks like.
    let getHandler: any;
    mockApp.get = vi.fn((_path, handler) => {
      getHandler = handler;
    });

    await mountMcpServer(mockApp, mockOptions);

    const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any;
    await getHandler({ headers: { accept: 'text/html' } } as any, mockRes);

    const html = mockRes.end.mock.calls[0][0] as string;
    expect(html).toContain('This toolset requires a components manifest,');
    expect(html).toContain('<code>componentsManifest</code>');
    expect(html).toContain('<code>@storybook/angular-vite</code>');
    expect(html).not.toContain('React-based setups');
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('blames the framework, not the config, when the feature is on and there is still no manifest', async () => {
    const featureOnNoManifestOptions: MountSetup = {
      hooks: { 'core:features:extend': { componentsManifest: true } },
    };

    let getHandler: any;
    mockApp.get = vi.fn((_path, handler) => {
      getHandler = handler;
    });

    await mountMcpServer(mockApp, featureOnNoManifestOptions);

    const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any;
    await getHandler({ headers: { accept: 'text/html' } } as any, mockRes);

    const html = mockRes.end.mock.calls[0][0] as string;
    expect(html).toContain('which your framework does not generate');
    expect(html).not.toContain('Enable the <code>componentsManifest</code> feature');
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('prompts to enable the manifest feature when manifests exist but the flag is off', async () => {
    // Manifests are present on disk, but `componentsManifest` is not enabled — the docs
    // toolset is unavailable for a different reason than "no manifests", so the page shows
    // the "enable the feature" notice rather than the missing-manifest one.
    const manifestsNoFlagOptions: MountSetup = {
      hooks: {
        'core:features:extend': { componentsManifest: false },
        'index:manifests:extend': { components: { v: 1, components: {} } },
      },
    };

    let getHandler: any;
    mockApp.get = vi.fn((_path, handler) => {
      getHandler = handler;
    });

    await mountMcpServer(mockApp, manifestsNoFlagOptions);

    const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any;
    await getHandler({ headers: { accept: 'text/html' } } as any, mockRes);

    const html = mockRes.end.mock.calls[0][0] as string;
    expect(html).toContain('This toolset requires enabling the component manifest feature.');
    expect(html).not.toContain('This toolset requires a components manifest,');
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('should show Storybook version requirement for addon-vitest and a manual manifest link', async () => {
    // The mock Storybook has no addons, so addon-vitest reads as disabled.
    const manifestEnabledOptions: MountSetup = {
      hooks: {
        'core:features:extend': { experimentalComponentsManifest: true },
        'index:manifests:extend': { components: { v: 1, components: {} } },
      },
    };

    const handlers: Record<string, any> = {};
    mockApp.get = vi.fn((path: string, handler: any) => {
      handlers[path] = handler;
    });

    await mountMcpServer(mockApp, manifestEnabledOptions);
    const getMcpHandler = handlers['/mcp'];
    expect(getMcpHandler).toBeDefined();

    const mockReq = {
      headers: {
        accept: 'text/html',
      },
    } as any;
    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as any;

    await getMcpHandler(mockReq, mockRes);

    expect(mockRes.end).toHaveBeenCalledWith(
      expect.stringContaining('This toolset requires Storybook 10.3.0+ with')
    );
    expect(mockRes.end).toHaveBeenCalledWith(
      expect.stringContaining(
        'View the <a href="/manifests/components.html">component manifest debugger</a>.'
      )
    );
  });

  it('does not show the local manifest debugger link when docs only come from composed refs', async () => {
    const handlers: Record<string, any> = {};
    mockApp.get = vi.fn((path: string, handler: any) => {
      handlers[path] = handler;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('{"v":1,"components":{}}'),
      })
    );

    const remoteDocsOptions: MountSetup = {
      hooks: {
        'manager:refs:extend': {
          remote: { title: 'Remote', url: 'https://example.com/storybook' },
        },
        'core:features:extend': { componentsManifest: true },
      },
    };

    await mountMcpServer(mockApp, remoteDocsOptions);
    const getMcpHandler = handlers['/mcp'];
    expect(getMcpHandler).toBeDefined();

    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as any;

    await getMcpHandler({ headers: { accept: 'text/html' } } as any, mockRes);

    const html = mockRes.end.mock.calls[0][0];
    expect(html).not.toContain('{{MANIFEST_DEBUGGER_LINK}}');
    expect(html).not.toContain('/manifests/components.html');
    expect(html).toContain('<span class="toolset-status enabled">enabled</span>');
  });

  it('should handle POST requests as MCP protocol', async () => {
    await mountMcpServer(mockApp, mockOptions);

    const initializeRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
    });

    const mockReq = {
      method: 'POST',
      headers: {
        accept: 'text/html',
        'content-type': 'application/json',
        host: 'localhost:6006',
      },
      socket: { encrypted: false },
      url: '/',
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from(initializeRequest);
      },
    } as any;

    const mockRes = {
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn(),
      statusCode: 0,
    } as any;

    await mcpHandler(mockReq, mockRes);

    expect(mockRes.writeHead).not.toHaveBeenCalledWith(200, {
      'Content-Type': 'text/html',
    });
    expect(mockRes.end).not.toHaveBeenCalledWith(expect.stringContaining('<html'));
  });

  it('should return the app instance', async () => {
    const result = await mountMcpServer(mockApp, mockOptions);
    expect(result).toBe(mockApp);
  });

  describe('origin validation', () => {
    const initializeRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });

    const createRequest = (headers: Record<string, string>) =>
      ({
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          host: 'localhost:6006',
          ...headers,
        },
        socket: { encrypted: false },
        url: '/mcp',
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from(initializeRequest);
        },
      }) as any;

    const createResponse = () =>
      ({
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        setHeader: vi.fn(),
        statusCode: 0,
      }) as any;

    const createOptionsWithCore = (core: Record<string, unknown>): MountSetup => ({
      ...mockOptions,
      core,
    });

    it('rejects a POST whose Origin is not an allowed host', async () => {
      const handler = vi.spyOn(mcpHandlerModule, 'mcpServerHandler').mockResolvedValue(undefined);
      await mountMcpServer(mockApp, mockOptions);
      const res = createResponse();

      await mcpHandler(createRequest({ origin: 'http://malicious-site.com' }), res);

      expect(res.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'text/plain' });
      expect(res.end).toHaveBeenCalledWith('Invalid origin');
      expect(handler).not.toHaveBeenCalled();
    });

    it('rejects a non-HTML GET whose Origin is not an allowed host', async () => {
      const handler = vi.spyOn(mcpHandlerModule, 'mcpServerHandler').mockResolvedValue(undefined);
      const handlers: Record<string, any> = {};
      mockApp.get = vi.fn((path: string, routeHandler: any) => {
        handlers[path] = routeHandler;
      });
      await mountMcpServer(mockApp, mockOptions);
      const res = createResponse();

      await handlers['/mcp'](createRequest({ origin: 'http://malicious-site.com' }), res);

      expect(res.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'text/plain' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('rejects a POST whose Origin is not a URL', async () => {
      const handler = vi.spyOn(mcpHandlerModule, 'mcpServerHandler').mockResolvedValue(undefined);
      await mountMcpServer(mockApp, mockOptions);
      const res = createResponse();

      await mcpHandler(createRequest({ origin: 'null' }), res);

      expect(res.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'text/plain' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('rejects a POST whose Origin is an IP address that is not a known address', async () => {
      const handler = vi.spyOn(mcpHandlerModule, 'mcpServerHandler').mockResolvedValue(undefined);
      await mountMcpServer(mockApp, mockOptions);
      const res = createResponse();

      await mcpHandler(createRequest({ origin: 'http://203.0.113.5' }), res);

      expect(res.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'text/plain' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('accepts a POST without an Origin header', async () => {
      const handler = vi.spyOn(mcpHandlerModule, 'mcpServerHandler').mockResolvedValue(undefined);
      await mountMcpServer(mockApp, mockOptions);
      const res = createResponse();

      await mcpHandler(createRequest({}), res);

      expect(res.writeHead).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledOnce();
    });

    it('accepts a POST from a localhost Origin', async () => {
      const handler = vi.spyOn(mcpHandlerModule, 'mcpServerHandler').mockResolvedValue(undefined);
      await mountMcpServer(mockApp, mockOptions);
      const res = createResponse();

      await mcpHandler(createRequest({ origin: 'http://localhost:6006' }), res);

      expect(res.writeHead).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledOnce();
    });

    it('accepts a POST from an Origin listed in core.allowedHosts', async () => {
      const handler = vi.spyOn(mcpHandlerModule, 'mcpServerHandler').mockResolvedValue(undefined);
      await mountMcpServer(
        mockApp,
        createOptionsWithCore({ allowedHosts: ['my-app.example.com'] })
      );
      const res = createResponse();

      await mcpHandler(createRequest({ origin: 'https://my-app.example.com' }), res);

      expect(res.writeHead).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledOnce();
    });

    it('accepts any Origin when core.allowedHosts is true', async () => {
      const handler = vi.spyOn(mcpHandlerModule, 'mcpServerHandler').mockResolvedValue(undefined);
      await mountMcpServer(mockApp, createOptionsWithCore({ allowedHosts: true }));
      const res = createResponse();

      await mcpHandler(createRequest({ origin: 'http://malicious-site.com' }), res);

      expect(res.writeHead).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('media type validation', () => {
    const createRequest = (contentType: string | undefined) =>
      ({
        method: 'POST',
        headers: {
          accept: 'application/json',
          host: 'localhost:6006',
          ...(contentType === undefined ? {} : { 'content-type': contentType }),
        },
        socket: { encrypted: false },
        url: '/mcp',
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('{}');
        },
      }) as any;

    const createResponse = () =>
      ({
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        setHeader: vi.fn(),
        statusCode: 0,
      }) as any;

    it.each([
      undefined,
      'text/plain',
      'text/plain; x=application/json',
      'application/x-www-form-urlencoded',
    ])('rejects a POST whose Content-Type is %s', async (contentType) => {
      const handler = vi.spyOn(mcpHandlerModule, 'mcpServerHandler').mockResolvedValue(undefined);
      await mountMcpServer(mockApp, mockOptions);
      const res = createResponse();

      await mcpHandler(createRequest(contentType), res);

      expect(res.writeHead).toHaveBeenCalledWith(415, { 'Content-Type': 'text/plain' });
      expect(handler).not.toHaveBeenCalled();
    });

    it.each(['application/json', 'application/json; charset=utf-8', 'Application/JSON'])(
      'accepts a POST whose Content-Type is %s',
      async (contentType) => {
        const handler = vi.spyOn(mcpHandlerModule, 'mcpServerHandler').mockResolvedValue(undefined);
        await mountMcpServer(mockApp, mockOptions);
        const res = createResponse();

        await mcpHandler(createRequest(contentType), res);

        expect(res.writeHead).not.toHaveBeenCalled();
        expect(handler).toHaveBeenCalledOnce();
      }
    );
  });

  it('should handle partial toolsets configuration', async () => {
    const partialOptions: MountSetup = { ...mockOptions, toolsets: { dev: false } };

    await mountMcpServer(mockApp, partialOptions);

    expect(mockApp.post).toHaveBeenCalledWith('/mcp', expect.any(Function));
    expect(mockApp.get).toHaveBeenCalledWith('/mcp', expect.any(Function));
  });

  it('should register .well-known endpoint that returns 404 when no auth required', async () => {
    const handlers: Record<string, any> = {};
    mockApp.get = vi.fn((path: string, handler: any) => {
      handlers[path] = handler;
    });

    await mountMcpServer(mockApp, mockOptions);

    const wellKnownHandler = handlers['/.well-known/oauth-protected-resource'];
    expect(wellKnownHandler).toBeDefined();

    const mockRes = { writeHead: vi.fn(), end: vi.fn() } as any;
    wellKnownHandler({}, mockRes);

    expect(mockRes.writeHead).toHaveBeenCalledWith(404);
    expect(mockRes.end).toHaveBeenCalledWith('Not found');
  });

  it('should forward non-HTML GET /mcp requests to MCP handler', async () => {
    const handlers: Record<string, any> = {};
    mockApp.get = vi.fn((path: string, handler: any) => {
      handlers[path] = handler;
    });

    await mountMcpServer(mockApp, mockOptions);

    const getMcpHandler = handlers['/mcp'];
    expect(getMcpHandler).toBeDefined();

    // Non-HTML request (JSON accept) — uses POST method since GET can't have body
    const mockReq = {
      method: 'POST',
      headers: { accept: 'application/json', host: 'localhost:6006' },
      socket: { encrypted: false },
      url: '/mcp',
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: { name: 'test', version: '1.0.0' },
            },
          })
        );
      },
    } as any;

    const mockRes = {
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn(),
      statusCode: 0,
    } as any;

    await getMcpHandler(mockReq, mockRes);

    // Should NOT serve HTML — goes through MCP handler instead
    expect(mockRes.writeHead).not.toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
  });

  it('should parse refs from storybook config', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: () => Promise.resolve('{"v":1,"components":{}}'),
      })
    );

    const storybook = createStorybook({
      hooks: {
        'manager:refs:extend': {
          'my-lib': { title: 'My Library', url: 'https://my-lib.example.com' },
          'design-system': { url: 'https://ds.example.com' },
        },
        'core:features:extend': { componentsManifest: false },
      },
    });

    await mount(mockApp, storybook as unknown as McpStorybook);

    expect(storybook.callHook).toHaveBeenCalledWith('manager:refs:extend', {});
  });

  it('should handle refs config returning non-object gracefully', async () => {
    const optionsWithBadRefs: MountSetup = {
      hooks: {
        'manager:refs:extend': null,
        'core:features:extend': { componentsManifest: false },
      },
    };

    // Should not throw
    const result = await mountMcpServer(mockApp, optionsWithBadRefs);
    expect(result).toBe(mockApp);
  });

  it('should handle refs config throwing gracefully', async () => {
    const optionsWithThrowingRefs: MountSetup = {
      hooks: {
        'manager:refs:extend': () => Promise.reject(new Error('Config error')),
        'core:features:extend': { componentsManifest: false },
      },
    };

    const result = await mountMcpServer(mockApp, optionsWithThrowingRefs);
    expect(result).toBe(mockApp);
  });
});
