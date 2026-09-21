import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerCoreToolsetsForTest } from './test-support/register-core-toolsets.ts';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { logger } from 'storybook/internal/node-logger';
import {
  getEffectiveToolAvailability,
  getToolAvailability,
  isModuleGraphSupportedByBuilder,
  type ToolAvailability,
} from 'storybook/internal/core-server';
import { buildStorybookAiMetadata } from './storybook-ai-metadata.ts';
import type { AddonContext } from './types.ts';
import { toMcpToolName } from 'storybook/internal/toolsets-docs';
import {
  DISPLAY_REVIEW_TOOL_NAME,
  GET_STORIES_BY_COMPONENT_TOOL_NAME,
  GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
  PREVIEW_STORIES_TOOL_NAME,
  RUN_STORY_TESTS_TOOL_NAME,
} from './tools/tool-names.ts';
import { registerAddonMcpTools } from './tools/tool-registry.ts';

// `getToolAvailability` and `isModuleGraphSupportedByBuilder` now live in core
// (`storybook/internal/core-server`) and compose their own sub-probes internally, so this file
// controls availability at that single seam rather than mocking each sub-probe individually. Core's
// own `availability.test.ts` covers the composition and the module-graph probing behavior.
vi.mock('storybook/internal/core-server', { spy: true });

describe('buildStorybookAiMetadata', () => {
  beforeEach(() => {
    // The `services` preset hook does this in a real Storybook before metadata is built.
    registerCoreToolsetsForTest();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(mockManifestFetch(true)));
    vi.mocked(getToolAvailability).mockResolvedValue(createAvailability());
    vi.mocked(isModuleGraphSupportedByBuilder).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('builds the same all-enabled tool descriptors as tmcp tools/list', async () => {
    const options = createOptions({
      refs: {
        remote: { title: 'Remote', url: 'https://example.com/storybook' },
      },
    });

    const metadata = await buildStorybookAiMetadata(options);
    const liveTools = await listRegisteredTools(options, { multiSource: true });

    expect(metadata.tools.map((tool) => tool.name)).toEqual(
      liveTools.map((tool: { name: string }) => tool.name)
    );
    expect(simplifyTools(metadata.tools)).toEqual(simplifyTools(liveTools));
    expect(metadata.instructions).toContain('## UI Building and Story Writing Workflow');
    expect(metadata.instructions).toContain('## Validation Workflow');
    expect(metadata.instructions).toContain('## Documentation Workflow');

    const getDocumentationTool = metadata.tools.find((tool) => tool.name === GET_TOOL_NAME);
    expect(getDocumentationTool?.inputSchema.properties).toHaveProperty('storybookId');

    const result = await metadata.localTools[GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME]?.call();
    expect(result?.content[0]?.text).toContain('@storybook/react-vite');
    expect(result?.content[0]?.text).toContain('@storybook/react');
    expect(result?.content[0]?.text).not.toContain('{{FRAMEWORK}}');

    const liveResult = await callRegisteredTool(options, GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME, {
      multiSource: true,
    });
    expect(result).toEqual(liveResult);
  });

  // Regression guard: the metadata-local-tool call sources `reviewEnabled` from the mocked
  // `getToolAvailability` seam (via the `availability.reviewEnabled` override threaded through
  // `tool-registry.ts`'s `getLocalTool`), while `buildStorybookStoryInstructions`'s adapter falls
  // back to the real (unmocked) `resolveSkillInputs` whenever that override is absent. Tune the
  // fixture so the two would DISAGREE if the override were ever dropped — real presets say review
  // is off (`experimentalReview: false`), but the mocked availability says it's on — so this only
  // passes when the override is genuinely driving the result, not merely coinciding with a fallback
  // that happens to compute the same value.
  it('drives the local tool instructions from the resolved availability override, not a coincidental real-probe fallback', async () => {
    vi.mocked(getToolAvailability).mockResolvedValue(
      createAvailability({ reviewEnabled: true, reviewEnabledForCli: true })
    );
    const options = createOptions({
      features: { changeDetection: true, componentsManifest: true, experimentalReview: false },
    });

    const metadata = await buildStorybookAiMetadata(options);
    const result = await metadata.localTools[GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME]?.call();
    const text = result?.content[0]?.text as string;

    // If the override were dropped, this would fall through to the real `resolveSkillInputs`
    // fallback, which — given `experimentalReview: false` above — resolves review OFF and would
    // render the preview-URL variant instead.
    expect(text).toContain('## 👀 Review your changes');
    expect(text).not.toContain('include every returned preview URL');
  });

  it('respects disabled addon toolsets', async () => {
    const metadata = await buildStorybookAiMetadata(
      createOptions({
        toolsets: { dev: false, docs: false, test: false },
      })
    );

    expect(metadata.instructions).toBe('');
    expect(metadata.tools).toEqual([]);
    expect(metadata.localTools).toEqual({});
  });

  it('uses the shared effective availability rule for composed-source docs', () => {
    const localOnlyAvailability = createAvailability({
      docsEnabled: false,
      docsHasManifests: false,
      docsFeatureEnabled: false,
    });

    expect(getEffectiveToolAvailability(localOnlyAvailability)).toBe(localOnlyAvailability);
    expect(
      getEffectiveToolAvailability(localOnlyAvailability, { multiSource: true })
    ).toMatchObject({
      docsEnabled: true,
      docsHasManifests: true,
      docsFeatureEnabled: true,
    });
  });

  it.each([
    ['dev disabled', { dev: false, docs: true, test: true }],
    ['docs disabled', { dev: true, docs: false, test: true }],
    ['test disabled', { dev: true, docs: true, test: false }],
    ['all disabled', { dev: false, docs: false, test: false }],
  ])('matches live tools/list when %s', async (_label, toolsets) => {
    const options = createOptions({ toolsets });

    const metadata = await buildStorybookAiMetadata(options);
    const liveTools = await listRegisteredTools(options, { toolsets });

    expect(metadata.tools.map((tool) => tool.name)).toEqual(
      liveTools.map((tool: { name: string }) => tool.name)
    );
    expect(simplifyTools(metadata.tools)).toEqual(simplifyTools(liveTools));
  });

  it('keeps addon-vitest availability aligned between metadata and live tools/list', async () => {
    vi.mocked(getToolAvailability).mockResolvedValue(createAvailability({ testSupported: false }));
    const options = createOptions();

    const metadata = await buildStorybookAiMetadata(options);
    const liveTools = await listRegisteredTools(options, {
      availability: createAvailability({ testSupported: false }),
    });

    expect(metadata.tools.map((tool) => tool.name)).not.toContain(RUN_STORY_TESTS_TOOL_NAME);
    expect(metadata.tools.map((tool) => tool.name)).toEqual(
      liveTools.map((tool: { name: string }) => tool.name)
    );
    expect(simplifyTools(metadata.tools)).toEqual(simplifyTools(liveTools));
  });

  it('does not enable multi-source docs schemas for refs without manifests', async () => {
    const fetchMock = vi.fn(mockManifestFetch(false));
    vi.stubGlobal('fetch', fetchMock);
    const options = createOptions({
      refs: {
        remote: { title: 'Remote', url: 'https://example.com/storybook' },
      },
    });

    const metadata = await buildStorybookAiMetadata(options);
    const liveTools = await listRegisteredTools(options, { multiSource: false });

    const getDocumentationTool = metadata.tools.find((tool) => tool.name === GET_TOOL_NAME);
    expect(getDocumentationTool?.inputSchema.properties).not.toHaveProperty('storybookId');
    expect(metadata.tools.map((tool) => tool.name)).toEqual(
      liveTools.map((tool: { name: string }) => tool.name)
    );
    expect(simplifyTools(metadata.tools)).toEqual(simplifyTools(liveTools));
    expect(fetchMock.mock.calls.map(([input]) => getFetchUrl(input))).not.toContain(
      'https://example.com/storybook/mcp'
    );
  });

  it('skips malformed refs without dropping valid refs', async () => {
    const fetchMock = vi.fn(mockManifestFetch(true));
    vi.stubGlobal('fetch', fetchMock);
    const options = createOptions({
      refs: {
        missingUrl: { title: 'Missing URL' },
        nullRef: null,
        valid: { title: 'Valid', url: 'https://example.com/storybook' },
      },
    });

    const metadata = await buildStorybookAiMetadata(options);

    const getDocumentationTool = metadata.tools.find((tool) => tool.name === GET_TOOL_NAME);
    expect(getDocumentationTool?.inputSchema.properties).toHaveProperty('storybookId');
    expect(fetchMock.mock.calls.map(([input]) => getFetchUrl(input))).toEqual([
      'https://example.com/storybook/manifests/components.json',
    ]);
  });

  it('bounds serverless manifest probe latency', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const metadataPromise = buildStorybookAiMetadata(
      createOptions({
        refs: {
          remote: { title: 'Remote', url: 'https://example.com/storybook' },
        },
      })
    );

    await vi.advanceTimersByTimeAsync(3_000);
    const metadata = await metadataPromise;

    const getDocumentationTool = metadata.tools.find((tool) => tool.name === GET_TOOL_NAME);
    expect(getDocumentationTool?.inputSchema.properties).not.toHaveProperty('storybookId');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('enables multi-source docs schemas for authenticated refs without calling /mcp', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getFetchUrl(input);
      if (url.endsWith('/manifests/components.json')) {
        return new Response('Authentication required', {
          status: 401,
          headers: {
            'WWW-Authenticate':
              'Bearer resource_metadata="https://private.example.com/.well-known/oauth-protected-resource"',
          },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const options = createOptions({
      refs: {
        private: { title: 'Private', url: 'https://private.example.com/storybook' },
      },
    });

    const metadata = await buildStorybookAiMetadata(options);
    const liveTools = await listRegisteredTools(options, { multiSource: true });

    const getDocumentationTool = metadata.tools.find((tool) => tool.name === GET_TOOL_NAME);
    expect(getDocumentationTool?.inputSchema.properties).toHaveProperty('storybookId');
    expect(metadata.tools.map((tool) => tool.name)).toEqual(
      liveTools.map((tool: { name: string }) => tool.name)
    );
    expect(simplifyTools(metadata.tools)).toEqual(simplifyTools(liveTools));
    expect(fetchMock.mock.calls.map(([input]) => getFetchUrl(input))).not.toContain(
      'https://private.example.com/storybook/mcp'
    );
  });

  it('does not resolve composed refs when docs metadata is unavailable', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('should not fetch refs');
    });
    vi.stubGlobal('fetch', fetchMock);

    await buildStorybookAiMetadata(
      createOptions({
        refs: {
          remote: { title: 'Remote', url: 'https://example.com/storybook' },
        },
        toolsets: { dev: true, docs: false, test: true },
      })
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('enables docs metadata for serverless refs even when local docs are unavailable', async () => {
    vi.mocked(getToolAvailability).mockResolvedValue(
      createAvailability({ docsEnabled: false, docsHasManifests: false })
    );
    const options = createOptions({
      refs: {
        remote: { title: 'Remote', url: 'https://example.com/storybook' },
      },
    });

    const metadata = await buildStorybookAiMetadata(options);
    const liveTools = await listRegisteredTools(options, {
      availability: getEffectiveToolAvailability(
        createAvailability({
          docsEnabled: false,
          docsHasManifests: false,
        }),
        { multiSource: true }
      ),
      multiSource: true,
    });

    const getDocumentationTool = metadata.tools.find((tool) => tool.name === GET_TOOL_NAME);
    expect(getDocumentationTool?.inputSchema.properties).toHaveProperty('storybookId');
    expect(metadata.instructions).toContain('## Documentation Workflow');
    expect(metadata.tools.map((tool) => tool.name)).toEqual(
      liveTools.map((tool: { name: string }) => tool.name)
    );
    expect(simplifyTools(metadata.tools)).toEqual(simplifyTools(liveTools));
  });

  it('does not run registration side effects for statically disabled toolsets', async () => {
    const loggerSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});

    try {
      await listRegisteredTools(createOptions(), {
        toolsets: { dev: true, docs: false, test: true },
        gateRegistrationWithToolsets: true,
      });

      expect(loggerSpy).not.toHaveBeenCalledWith(
        'Experimental components manifest feature detected - registering component tools'
      );
    } finally {
      loggerSpy.mockRestore();
    }
  });

  it('deduplicates existing preset metadata by tool name and instruction text', async () => {
    const options = createOptions({
      refs: {
        remote: { title: 'Remote', url: 'https://example.com/storybook' },
      },
    });
    const first = await buildStorybookAiMetadata(options);
    const merged = await buildStorybookAiMetadata(options, {
      ...first,
      tools: [
        {
          name: PREVIEW_STORIES_TOOL_NAME,
          description: 'stale descriptor',
          inputSchema: { type: 'object' },
        },
        ...first.tools,
      ],
    });

    expect(merged.instructions).toBe(first.instructions);
    expect(merged.tools.map((tool) => tool.name)).toEqual(first.tools.map((tool) => tool.name));
    expect(merged.tools.filter((tool) => tool.name === PREVIEW_STORIES_TOOL_NAME)).toHaveLength(1);
    expect(
      merged.tools.find((tool) => tool.name === PREVIEW_STORIES_TOOL_NAME)?.description
    ).not.toBe('stale descriptor');
  });

  it('matches live tools/list when the module graph service is unavailable', async () => {
    vi.mocked(isModuleGraphSupportedByBuilder).mockResolvedValue(false);
    vi.mocked(getToolAvailability).mockResolvedValue(
      createAvailability({ moduleGraphSupported: false, changeDetectionEnabled: false })
    );
    const options = createOptions({
      builder: '@storybook/builder-vite',
      features: { changeDetection: false, componentsManifest: true },
      toolsets: { dev: true, docs: false, test: false },
    });

    const metadata = await buildStorybookAiMetadata(options);
    const liveTools = await listRegisteredTools(options, {
      availability: createAvailability({
        moduleGraphSupported: false,
        changeDetectionEnabled: false,
      }),
      toolsets: { dev: true, docs: false, test: false },
    });

    expect(metadata.tools.map((tool) => tool.name)).not.toContain(
      GET_STORIES_BY_COMPONENT_TOOL_NAME
    );
    expect(metadata.tools.map((tool) => tool.name)).toEqual(
      liveTools.map((tool: { name: string }) => tool.name)
    );
    expect(simplifyTools(metadata.tools)).toEqual(simplifyTools(liveTools));
  });

  it('defaults review on for the CLI channel when experimentalReview is unset', async () => {
    // What getReviewStatus (inside core's getToolAvailability) returns when changeDetection is on
    // and experimentalReview is neither true nor false.
    vi.mocked(getToolAvailability).mockResolvedValue(
      createAvailability({ reviewEnabled: false, reviewEnabledForCli: true })
    );

    const metadata = await buildStorybookAiMetadata(createOptions());

    expect(metadata.tools.map((tool) => tool.name)).toContain(DISPLAY_REVIEW_TOOL_NAME);
    expect(metadata.instructions).toContain(DISPLAY_REVIEW_TOOL_NAME);
  });

  it('keeps review off everywhere when experimentalReview is explicitly false', async () => {
    vi.mocked(getToolAvailability).mockResolvedValue(
      createAvailability({ reviewEnabled: false, reviewEnabledForCli: false })
    );

    const metadata = await buildStorybookAiMetadata(createOptions());

    expect(metadata.tools.map((tool) => tool.name)).not.toContain(DISPLAY_REVIEW_TOOL_NAME);
  });

  it('uses builder support instead of the live module-graph service for metadata', async () => {
    vi.mocked(isModuleGraphSupportedByBuilder).mockResolvedValue(true);
    vi.mocked(getToolAvailability).mockImplementation(async (_options, opts) =>
      createAvailability({ moduleGraphSupported: opts?.moduleGraphSupported ?? false })
    );
    const options = createOptions({
      toolsets: { dev: true, docs: false, test: false },
    });

    const metadata = await buildStorybookAiMetadata(options);

    expect(metadata.tools.map((tool) => tool.name)).toContain(GET_STORIES_BY_COMPONENT_TOOL_NAME);
    expect(isModuleGraphSupportedByBuilder).toHaveBeenCalled();
    // The builder-support result must be the value fed into `getToolAvailability`'s override —
    // proving the serverless path never falls through to the live-service probe.
    expect(getToolAvailability).toHaveBeenCalledWith(
      options,
      expect.objectContaining({ moduleGraphSupported: true })
    );
  });
});

function mockManifestFetch(hasManifest: boolean) {
  return async (input: RequestInfo | URL) => {
    const url = getFetchUrl(input);
    if (url.endsWith('/manifests/components.json') && hasManifest) {
      return new Response(JSON.stringify({ v: 1, components: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  };
}

function getFetchUrl(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}

function createOptions({
  builder = '@storybook/builder-vite',
  // `experimentalReview: true` so that the real (core-internal) `resolveSkillInputs` fallback used
  // by `buildStorybookStoryInstructions` when no per-request `reviewEnabled` context is set agrees
  // with the default mocked `getToolAvailability` result (`createAvailability()`, reviewEnabled:
  // true) — both computation paths must resolve review the same way for the metadata/live parity
  // tests below to hold.
  features = { changeDetection: true, componentsManifest: true, experimentalReview: true },
  framework = '@storybook/react-vite',
  refs = {},
  toolsets = { dev: true, docs: true, test: true },
}: {
  builder?: string | null;
  features?: Record<string, unknown>;
  framework?: string;
  refs?: Record<string, unknown>;
  toolsets?: { dev?: boolean; docs?: boolean; test?: boolean };
} = {}) {
  return {
    configDir: '/project/.storybook',
    endpoint: undefined,
    toolsets,
    presets: {
      apply: vi.fn(async (key: string, defaultValue?: unknown) => {
        if (key === 'features') {
          return features;
        }
        if (key === 'core') {
          return { builder: builder ?? undefined };
        }
        if (key === 'framework') {
          return framework;
        }
        if (key === 'refs') {
          return refs;
        }
        return defaultValue;
      }),
    },
  } as any;
}

/**
 * The published tool surface for each availability combination.
 *
 * Availability decides which tools an agent is offered at all, so it is part of the wire contract
 * and not just internal wiring. These pin the surface per combination; the descriptions and schemas
 * behind each name are snapshotted by the e2e suite against a live server.
 */
const LIST_TOOL_NAME = toMcpToolName('docs.list');
const GET_TOOL_NAME = toMcpToolName('docs.show');

describe('tool availability variants', () => {
  // This block runs outside the describe above, so it stands up the toolsets itself instead of
  // leaning on registrations leaking through the module-global registry.
  beforeEach(() => {
    registerCoreToolsetsForTest();
  });

  const names = async (overrides: Partial<ToolAvailability>) =>
    (await listRegisteredTools(createOptions(), { availability: createAvailability(overrides) }))
      .map((tool: { name: string }) => tool.name)
      .sort();

  it('offers no review tool when review is off', async () => {
    const withReview = await names({});
    const withoutReview = await names({ reviewEnabled: false, changeDetectionEnabled: false });

    expect(withReview).toContain(DISPLAY_REVIEW_TOOL_NAME);
    expect(withoutReview).not.toContain(DISPLAY_REVIEW_TOOL_NAME);
  });

  it('offers no test tool when addon-vitest is absent', async () => {
    expect(await names({ testSupported: false })).not.toContain(RUN_STORY_TESTS_TOOL_NAME);
  });

  it('keeps the docs tools when a11y is off, which only varies their prose', async () => {
    expect(await names({ a11yEnabled: false })).toEqual(await names({ a11yEnabled: true }));
  });

  it('offers no docs tools when docs are unavailable', async () => {
    const withoutDocs = await names({
      docsEnabled: false,
      docsHasManifests: false,
      docsFeatureEnabled: false,
    });

    expect(withoutDocs).not.toContain(LIST_TOOL_NAME);
    expect(withoutDocs).not.toContain(GET_TOOL_NAME);
  });
});

function createAvailability(overrides: Partial<ToolAvailability> = {}): ToolAvailability {
  return {
    moduleGraphSupported: true,
    changeDetectionEnabled: true,
    reviewEnabled: true,
    reviewEnabledForCli: true,
    docsEnabled: true,
    docsEnabledForCli: true,
    docsHasManifests: true,
    docsFeatureEnabled: true,
    testSupported: true,
    a11yEnabled: true,
    docgenServer: false,
    ...overrides,
  };
}

async function listRegisteredTools(
  options: AddonContext['options'],
  {
    availability = createAvailability(),
    multiSource = false,
    toolsets = { dev: true, docs: true, test: true },
    gateRegistrationWithToolsets = false,
  }: {
    availability?: ToolAvailability;
    multiSource?: boolean;
    toolsets?: AddonContext['toolsets'];
    gateRegistrationWithToolsets?: boolean;
  } = {}
) {
  const adapter = new ValibotJsonSchemaAdapter();
  const server = new McpServer(
    {
      name: 'test-server',
      version: '1.0.0',
      description: 'Test server for AI metadata parity',
    },
    {
      adapter,
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
      },
    }
  ).withContext<AddonContext>();

  await server.receive(
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      },
    },
    {
      sessionId: 'test-session',
    }
  );

  await registerAddonMcpTools(server, {
    availability,
    multiSource,
    ...(gateRegistrationWithToolsets ? { toolsets } : {}),
  });

  const response = await server.receive(
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    },
    {
      sessionId: 'test-session',
      custom: {
        origin: 'http://localhost:6006',
        options,
        disableTelemetry: true,
        a11yEnabled: availability.a11yEnabled,
        toolsets,
      },
    }
  );

  return response.result?.tools ?? [];
}

async function callRegisteredTool(
  options: AddonContext['options'],
  name: string,
  {
    availability = createAvailability(),
    multiSource = false,
    toolsets = { dev: true, docs: true, test: true },
  }: {
    availability?: ToolAvailability;
    multiSource?: boolean;
    toolsets?: AddonContext['toolsets'];
  } = {}
) {
  const server = new McpServer(
    {
      name: 'test-server',
      version: '1.0.0',
      description: 'Test server for AI metadata parity',
    },
    {
      adapter: new ValibotJsonSchemaAdapter(),
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
      },
    }
  ).withContext<AddonContext>();

  await server.receive(
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      },
    },
    {
      sessionId: 'test-session',
    }
  );

  await registerAddonMcpTools(server, { availability, multiSource });

  const response = await server.receive(
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name, arguments: {} },
    },
    {
      sessionId: 'test-session',
      custom: {
        origin: 'http://localhost:6006',
        options,
        disableTelemetry: true,
        a11yEnabled: availability.a11yEnabled,
        toolsets,
      },
    }
  );

  return response.result;
}

function simplifyTools(tools: any[]) {
  return tools.map(({ name, title, description, inputSchema, outputSchema, _meta }) => ({
    name,
    title,
    description,
    inputSchema,
    outputSchema,
    _meta,
  }));
}
