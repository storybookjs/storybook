// oxlint-disable typescript-eslint(unbound-method) -- I'm unsure how to fix this properly
import { describe, it, expect, vi } from 'vitest';
import {
	incomingMessageToWebRequest,
	webResponseToServerResponse,
	mcpServerHandler,
	getToolsets,
} from './mcp-handler.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PassThrough } from 'node:stream';

// Mock dependencies
vi.mock('./telemetry.ts', () => ({
	collectTelemetry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./tools/get-story-urls.ts', () => ({
	addGetStoryUrlsTool: vi.fn().mockResolvedValue(undefined),
	GET_STORY_URLS_TOOL_NAME: 'get_story_urls',
}));

vi.mock('./tools/get-ui-building-instructions.ts', () => ({
	addGetUIBuildingInstructionsTool: vi.fn().mockResolvedValue(undefined),
	GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME: 'get_ui_building_instructions',
}));

vi.mock('@storybook/mcp', () => ({
	addListAllComponentsTool: vi.fn().mockResolvedValue(undefined),
	addGetComponentDocumentationTool: vi.fn().mockResolvedValue(undefined),
	LIST_TOOL_NAME: 'list-all-components',
	GET_TOOL_NAME: 'get-component-documentation',
}));

// Test helpers to reduce boilerplate
function createMockIncomingMessage(options: {
	method?: string;
	url?: string;
	headers?: Record<string, string>;
	body?: string | object;
}): IncomingMessage {
	const { method = 'GET', url = '/mcp', headers = {}, body } = options;

	const passThrough = new PassThrough();

	// Write body if provided
	if (body) {
		const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
		passThrough.end(Buffer.from(bodyString));
	} else {
		passThrough.end();
	}

	return Object.assign(passThrough, {
		method,
		url,
		headers: {
			host: 'localhost:6006',
			...headers,
		},
		socket: {},
	}) as unknown as IncomingMessage;
}

function createMockServerResponse(): {
	response: ServerResponse;
	getResponseData: () => {
		status: number;
		headers: Map<string, string>;
		body: string;
	};
} {
	const headers = new Map<string, string>();
	const chunks: Uint8Array[] = [];

	const mockResponse = {
		statusCode: 0,
		setHeader: vi.fn((key: string, value: string) => {
			headers.set(key, value);
		}),
		write: vi.fn((chunk: Uint8Array) => {
			chunks.push(chunk);
		}),
		end: vi.fn(),
	} as unknown as ServerResponse;

	return {
		response: mockResponse,
		getResponseData: () => ({
			status: mockResponse.statusCode,
			headers,
			body: Buffer.concat(chunks).toString(),
		}),
	};
}

describe('mcp-handler conversion utilities', () => {
	describe('incomingMessageToWebRequest', () => {
		it('should convert GET request to Web Request', async () => {
			const mockReq = createMockIncomingMessage({
				method: 'GET',
				headers: { 'content-type': 'application/json' },
			});

			const webRequest = await incomingMessageToWebRequest(mockReq);

			expect(webRequest.method).toBe('GET');
			expect(webRequest.url).toBe('http://localhost:6006/mcp');
			expect(webRequest.headers.get('content-type')).toBe('application/json');
		});

		it('should convert POST request with body to Web Request', async () => {
			const body = { message: 'test' };
			const mockReq = createMockIncomingMessage({
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body,
			});

			const webRequest = await incomingMessageToWebRequest(mockReq);

			expect(webRequest.method).toBe('POST');
			const receivedBody = await webRequest.text();
			expect(JSON.parse(receivedBody)).toEqual(body);
		});

		it('should handle request with query parameters', async () => {
			const mockReq = createMockIncomingMessage({
				url: '/mcp?session=123',
			});

			const webRequest = await incomingMessageToWebRequest(mockReq);

			expect(webRequest.url).toBe('http://localhost:6006/mcp?session=123');
		});

		it('should handle empty body', async () => {
			const mockReq = createMockIncomingMessage({
				method: 'POST',
			});

			const webRequest = await incomingMessageToWebRequest(mockReq);

			expect(webRequest.method).toBe('POST');
			expect(webRequest.body).toBe(null);
		});

		it('should preserve custom headers', async () => {
			const mockReq = createMockIncomingMessage({
				method: 'POST',
				headers: {
					'x-custom-header': 'custom-value',
					authorization: 'Bearer token123',
				},
			});

			const webRequest = await incomingMessageToWebRequest(mockReq);

			expect(webRequest.headers.get('x-custom-header')).toBe('custom-value');
			expect(webRequest.headers.get('authorization')).toBe('Bearer token123');
		});
	});

	describe('webResponseToServerResponse', () => {
		it('should convert Web Response to Node.js ServerResponse', async () => {
			const webResponse = new Response('Hello World', {
				status: 200,
				headers: { 'content-type': 'text/plain' },
			});

			const { response, getResponseData } = createMockServerResponse();

			await webResponseToServerResponse(webResponse, response);

			const { status, headers, body } = getResponseData();
			expect(status).toBe(200);
			expect(headers.get('content-type')).toBe('text/plain');
			expect(body).toBe('Hello World');
			expect(response.end).toHaveBeenCalled();
		});

		it('should handle JSON responses', async () => {
			const responseBody = { message: 'success', data: [1, 2, 3] };
			const webResponse = new Response(JSON.stringify(responseBody), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			});

			const { response, getResponseData } = createMockServerResponse();

			await webResponseToServerResponse(webResponse, response);

			const { body } = getResponseData();
			expect(JSON.parse(body)).toEqual(responseBody);
		});

		it('should handle error status codes', async () => {
			const webResponse = new Response('Not Found', {
				status: 404,
				headers: { 'content-type': 'text/plain' },
			});

			const { response, getResponseData } = createMockServerResponse();

			await webResponseToServerResponse(webResponse, response);

			const { status } = getResponseData();
			expect(status).toBe(404);
		});

		it('should handle server error status codes', async () => {
			const webResponse = new Response('Internal Server Error', {
				status: 500,
			});

			const { response, getResponseData } = createMockServerResponse();

			await webResponseToServerResponse(webResponse, response);

			const { status } = getResponseData();
			expect(status).toBe(500);
		});
	});
});

describe('mcpServerHandler', () => {
	function createMockOptions(overrides = {}) {
		return {
			port: 6006,
			presets: {
				apply: vi.fn().mockResolvedValue({ disableTelemetry: false }),
			},
			...overrides,
		};
	}

	function createMCPInitializeRequest() {
		return {
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: {
				protocolVersion: '2025-06-18',
				capabilities: {},
				clientInfo: { name: 'test-client', version: '1.0.0' },
			},
		};
	}

	it('should initialize MCP server and handle requests', async () => {
		const mockOptions = createMockOptions();
		const mockReq = createMockIncomingMessage({
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: createMCPInitializeRequest(),
		});
		const { response, getResponseData } = createMockServerResponse();

		await mcpServerHandler({
			req: mockReq,
			res: response,
			options: mockOptions as any,
			addonOptions: {
				toolsets: {
					dev: true,
					docs: true,
				},
			},
		});

		const { body } = getResponseData();
		expect(response.end).toHaveBeenCalled();

		const responseText = body.replace(/^data: /, '').trim();
		const parsedResponse = JSON.parse(responseText);

		expect(parsedResponse).toMatchObject({
			jsonrpc: '2.0',
			id: 1,
			result: {
				protocolVersion: '2025-06-18',
				adapter: {},
				capabilities: {
					tools: { listChanged: true },
				},
				serverInfo: {
					name: '@storybook/addon-mcp',
					description:
						'Help agents automatically write and test stories for your UI components',
				},
			},
		});
		expect(parsedResponse.result.serverInfo.version).toBeDefined();
	});

	it('should respect disableTelemetry setting', async () => {
		const { collectTelemetry } = await import('./telemetry.ts');
		vi.mocked(collectTelemetry).mockClear();

		const mockOptions = createMockOptions({
			port: 6007,
			presets: {
				apply: vi.fn().mockResolvedValue({ disableTelemetry: true }),
			},
		});
		const mockReq = createMockIncomingMessage({
			method: 'POST',
			url: '/mcp',
			headers: { 'content-type': 'application/json', host: 'localhost:6007' },
			body: createMCPInitializeRequest(),
		});
		const { response } = createMockServerResponse();

		// Reset module state by clearing transport
		const handler = await import('./mcp-handler.ts');
		(handler as any).transport = undefined;
		(handler as any).origin = undefined;

		await mcpServerHandler({
			req: mockReq,
			res: response,
			options: mockOptions as any,
			addonOptions: {
				toolsets: {
					dev: true,
					docs: true,
				},
			},
		});

		// Verify handler completes successfully when telemetry is disabled
		expect(response.end).toHaveBeenCalled();
	});

	it('should register tools from @storybook/mcp when feature flag and generator are enabled', async () => {
		// Force module reload to get fresh state
		vi.resetModules();

		const { mcpServerHandler: freshHandler } = await import('./mcp-handler.ts');
		const { addListAllComponentsTool, addGetComponentDocumentationTool } =
			await import('@storybook/mcp');

		const applyMock = vi.fn((key: string, defaultValue?: any) => {
			if (key === 'dev') {
				return Promise.resolve({ disableTelemetry: false });
			}
			if (key === 'features') {
				return Promise.resolve({ experimentalComponentsManifest: true });
			}
			if (key === 'experimental_componentManifestGenerator') {
				return Promise.resolve(vi.fn());
			}
			return Promise.resolve(defaultValue);
		});

		const mockOptions = createMockOptions({
			port: 6008,
			presets: { apply: applyMock },
		});
		const mockReq = createMockIncomingMessage({
			method: 'POST',
			headers: { 'content-type': 'application/json', host: 'localhost:6008' },
			body: createMCPInitializeRequest(),
		});
		const { response } = createMockServerResponse();

		await freshHandler({
			req: mockReq,
			res: response,
			options: mockOptions as any,
			addonOptions: {
				toolsets: {
					dev: true,
					docs: true,
				},
			},
		});

		// Verify component tools were registered
		expect(addListAllComponentsTool).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({
				tool: expect.any(Function),
			}),
			expect.any(Function),
		);
		expect(addGetComponentDocumentationTool).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({
				tool: expect.any(Function),
			}),
			expect.any(Function),
		);

		// Verify the 'enabled' callbacks matches the truthy addon options
		const listToolEnabledCallback = vi.mocked(addListAllComponentsTool).mock
			.calls[0]?.[1];
		const getToolEnabledCallback = vi.mocked(addGetComponentDocumentationTool)
			.mock.calls[0]?.[1];

		expect(listToolEnabledCallback?.()).toBe(true);
		expect(getToolEnabledCallback?.()).toBe(true);
	});
});

describe('getToolsets', () => {
	it('should return addon options when no header is present', () => {
		const request = new Request('http://localhost:6006/mcp');
		const addonOptions = {
			toolsets: {
				dev: true,
				docs: false,
			},
		};

		const result = getToolsets(request, addonOptions);

		expect(result).toEqual({
			dev: true,
			docs: false,
		});
	});

	it('should enable only toolsets specified in header', () => {
		const request = new Request('http://localhost:6006/mcp', {
			headers: { 'X-MCP-Toolsets': 'dev' },
		});
		const addonOptions = {
			toolsets: {
				dev: true,
				docs: true,
			},
		};

		const result = getToolsets(request, addonOptions);

		expect(result).toEqual({
			dev: true,
			docs: false,
		});
	});

	it('should enable multiple toolsets from comma-separated header', () => {
		const request = new Request('http://localhost:6006/mcp', {
			headers: {
				'X-MCP-Toolsets': 'dev,docs',
			},
		});
		const addonOptions = {
			toolsets: {
				dev: false,
				docs: false,
			},
		};

		const result = getToolsets(request, addonOptions);

		expect(result).toEqual({
			dev: true,
			docs: true,
		});
	});

	it('should handle whitespace in header values', () => {
		const request = new Request('http://localhost:6006/mcp', {
			headers: {
				'X-MCP-Toolsets': ' dev , docs ',
			},
		});
		const addonOptions = {
			toolsets: {
				dev: false,
				docs: false,
			},
		};

		const result = getToolsets(request, addonOptions);

		expect(result).toEqual({
			dev: true,
			docs: true,
		});
	});

	it('should ignore invalid toolset names in header', () => {
		const request = new Request('http://localhost:6006/mcp', {
			headers: {
				'X-MCP-Toolsets': 'dev,invalidToolset,docs',
			},
		});
		const addonOptions = {
			toolsets: {
				dev: false,
				docs: false,
			},
		};

		const result = getToolsets(request, addonOptions);

		expect(result).toEqual({
			dev: true,
			docs: true,
		});
	});

	it('should return addon options when header is present with empty value', () => {
		const request = new Request('http://localhost:6006/mcp', {
			headers: { 'X-MCP-Toolsets': '' },
		});
		const addonOptions = {
			toolsets: {
				dev: true,
				docs: true,
			},
		};

		const result = getToolsets(request, addonOptions);

		expect(result).toEqual({
			dev: true,
			docs: true,
		});
	});
});
