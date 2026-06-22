import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { GET_TOOL_NAME } from '@storybook/mcp';
import { logger } from 'storybook/internal/node-logger';
import { buildStorybookAiMetadata } from './storybook-ai-metadata.ts';
import { getAddonVitestConstants } from './tools/run-story-tests.ts';
import type { AddonContext } from './types.ts';
import { getManifestStatus } from './tools/is-manifest-available.ts';
import { isAddonA11yEnabled } from './utils/is-addon-a11y-enabled.ts';
import { getReviewStatus } from './utils/is-review-available.ts';
import { isModuleGraphSupported, isModuleGraphSupportedByBuilder } from './utils/module-graph.ts';
import {
	GET_STORIES_BY_COMPONENT_TOOL_NAME,
	GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
	PREVIEW_STORIES_TOOL_NAME,
	RUN_STORY_TESTS_TOOL_NAME,
} from './tools/tool-names.ts';
import { registerAddonMcpTools } from './tools/tool-registry.ts';
import {
	getEffectiveToolAvailability,
	type ToolAvailability,
} from './utils/get-tool-availability.ts';

vi.mock('./utils/module-graph.ts', () => ({
	isModuleGraphSupported: vi.fn(),
	isModuleGraphSupportedByBuilder: vi.fn(),
}));

vi.mock('./utils/is-review-available.ts', () => ({
	getReviewStatus: vi.fn(),
}));

vi.mock('./tools/is-manifest-available.ts', () => ({
	getManifestStatus: vi.fn(),
}));

vi.mock('./utils/is-addon-a11y-enabled.ts', () => ({
	isAddonA11yEnabled: vi.fn(),
}));

vi.mock('./tools/run-story-tests.ts', async (importActual) => ({
	...(await importActual<typeof import('./tools/run-story-tests.ts')>()),
	getAddonVitestConstants: vi.fn(),
}));

describe('buildStorybookAiMetadata', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('fetch', vi.fn(mockManifestFetch(true)));
		vi.mocked(isModuleGraphSupported).mockResolvedValue(true);
		vi.mocked(isModuleGraphSupportedByBuilder).mockResolvedValue(true);
		vi.mocked(getReviewStatus).mockResolvedValue({
			available: true,
			hasFeatureFlag: true,
		});
		vi.mocked(getManifestStatus).mockResolvedValue({
			available: true,
			hasManifests: true,
			hasFeatureFlag: true,
		});
		vi.mocked(getAddonVitestConstants).mockResolvedValue({
			TRIGGER_TEST_RUN_REQUEST: 'TRIGGER_TEST_RUN_REQUEST',
			TRIGGER_TEST_RUN_RESPONSE: 'TRIGGER_TEST_RUN_RESPONSE',
		});
		vi.mocked(isAddonA11yEnabled).mockResolvedValue(true);
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
			liveTools.map((tool: { name: string }) => tool.name),
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
		expect(isModuleGraphSupported).not.toHaveBeenCalled();
	});

	it('respects disabled addon toolsets', async () => {
		const metadata = await buildStorybookAiMetadata(
			createOptions({
				toolsets: { dev: false, docs: false, test: false },
			}),
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
			getEffectiveToolAvailability(localOnlyAvailability, { multiSource: true }),
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
			liveTools.map((tool: { name: string }) => tool.name),
		);
		expect(simplifyTools(metadata.tools)).toEqual(simplifyTools(liveTools));
	});

	it('keeps addon-vitest availability aligned between metadata and live tools/list', async () => {
		vi.mocked(getAddonVitestConstants).mockResolvedValue(undefined);
		const options = createOptions();

		const metadata = await buildStorybookAiMetadata(options);
		const liveTools = await listRegisteredTools(options, {
			availability: createAvailability({ testSupported: false }),
		});

		expect(metadata.tools.map((tool) => tool.name)).not.toContain(RUN_STORY_TESTS_TOOL_NAME);
		expect(metadata.tools.map((tool) => tool.name)).toEqual(
			liveTools.map((tool: { name: string }) => tool.name),
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
			liveTools.map((tool: { name: string }) => tool.name),
		);
		expect(simplifyTools(metadata.tools)).toEqual(simplifyTools(liveTools));
		expect(fetchMock.mock.calls.map(([input]) => getFetchUrl(input))).not.toContain(
			'https://example.com/storybook/mcp',
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
			}),
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
			liveTools.map((tool: { name: string }) => tool.name),
		);
		expect(simplifyTools(metadata.tools)).toEqual(simplifyTools(liveTools));
		expect(fetchMock.mock.calls.map(([input]) => getFetchUrl(input))).not.toContain(
			'https://private.example.com/storybook/mcp',
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
			}),
		);

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('enables docs metadata for serverless refs even when local docs are unavailable', async () => {
		vi.mocked(getManifestStatus).mockResolvedValue({
			available: false,
			hasManifests: false,
			hasFeatureFlag: true,
		});
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
				{ multiSource: true },
			),
			multiSource: true,
		});

		const getDocumentationTool = metadata.tools.find((tool) => tool.name === GET_TOOL_NAME);
		expect(getDocumentationTool?.inputSchema.properties).toHaveProperty('storybookId');
		expect(metadata.instructions).toContain('## Documentation Workflow');
		expect(metadata.tools.map((tool) => tool.name)).toEqual(
			liveTools.map((tool: { name: string }) => tool.name),
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
				'Experimental components manifest feature detected - registering component tools',
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
			merged.tools.find((tool) => tool.name === PREVIEW_STORIES_TOOL_NAME)?.description,
		).not.toBe('stale descriptor');
	});

	it('matches live tools/list when the module graph service is unavailable', async () => {
		vi.mocked(isModuleGraphSupportedByBuilder).mockResolvedValue(false);
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
			GET_STORIES_BY_COMPONENT_TOOL_NAME,
		);
		expect(metadata.tools.map((tool) => tool.name)).toEqual(
			liveTools.map((tool: { name: string }) => tool.name),
		);
		expect(simplifyTools(metadata.tools)).toEqual(simplifyTools(liveTools));
	});

	it('uses builder support instead of the live module-graph service for metadata', async () => {
		vi.mocked(isModuleGraphSupported).mockResolvedValue(false);
		vi.mocked(isModuleGraphSupportedByBuilder).mockResolvedValue(true);
		const options = createOptions({
			toolsets: { dev: true, docs: false, test: false },
		});

		const metadata = await buildStorybookAiMetadata(options);

		expect(metadata.tools.map((tool) => tool.name)).toContain(GET_STORIES_BY_COMPONENT_TOOL_NAME);
		expect(isModuleGraphSupportedByBuilder).toHaveBeenCalled();
		expect(isModuleGraphSupported).not.toHaveBeenCalled();
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
	features = { changeDetection: true, componentsManifest: true },
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

function createAvailability(overrides: Partial<ToolAvailability> = {}): ToolAvailability {
	return {
		moduleGraphSupported: true,
		changeDetectionEnabled: true,
		reviewEnabled: true,
		docsEnabled: true,
		docsHasManifests: true,
		docsFeatureEnabled: true,
		testSupported: true,
		a11yEnabled: true,
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
	} = {},
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
		},
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
		},
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
		},
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
	} = {},
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
		},
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
		},
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
		},
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
