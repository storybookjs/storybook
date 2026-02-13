import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { getAddonVitestConstants } from './run-story-tests.ts';
import { addGetUIBuildingInstructionsTool } from './get-storybook-story-instructions.ts';
import type { AddonContext } from '../types.ts';
import { PREVIEW_STORIES_TOOL_NAME, GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME } from './tool-names.ts';

vi.mock('./run-story-tests.ts', () => ({
	getAddonVitestConstants: vi.fn(),
}));

describe('getUIBuildingInstructionsTool', () => {
	let server: McpServer<any, AddonContext>;

	beforeEach(async () => {
		vi.mocked(getAddonVitestConstants).mockResolvedValue({
			TRIGGER_TEST_RUN_REQUEST: 'TRIGGER_TEST_RUN_REQUEST',
			TRIGGER_TEST_RUN_RESPONSE: 'TRIGGER_TEST_RUN_RESPONSE',
		});

		const adapter = new ValibotJsonSchemaAdapter();
		server = new McpServer(
			{
				name: 'test-server',
				version: '1.0.0',
				description: 'Test server for get-storybook-story-instructions tool',
			},
			{
				adapter,
				capabilities: {
					tools: { listChanged: true },
				},
			},
		).withContext<AddonContext>();

		// initialize test session
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

		await addGetUIBuildingInstructionsTool(server);
	});

	async function getToolDescription(context: AddonContext) {
		const response = await server.receive(
			{
				jsonrpc: '2.0' as const,
				id: 100,
				method: 'tools/list',
				params: {},
			},
			{
				sessionId: 'test-session',
				custom: context,
			},
		);

		const tools = response.result?.tools ?? [];
		const instructionsTool = tools.find(
			(tool: any) => tool.name === GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
		);
		return instructionsTool?.description as string;
	}

	it('should include testing and a11y description when available', async () => {
		const mockOptions = {
			presets: {
				apply: vi.fn().mockResolvedValue('@storybook/react-vite'),
			},
		};

		const description = await getToolDescription({
			origin: 'http://localhost:6006',
			options: mockOptions as any,
			disableTelemetry: true,
			a11yEnabled: true,
			toolsets: {
				dev: true,
				docs: true,
				test: true,
			},
		});

		expect(description).toContain('Running story tests or fixing test failures');
		expect(description).toContain(
			'Handling accessibility (a11y) violations in stories (fix semantic issues directly; ask before visual/design changes)',
		);
		expect(description).toContain('How to handle test failures and accessibility violations');
	});

	it('should exclude testing and a11y description when test toolset is disabled', async () => {
		const mockOptions = {
			presets: {
				apply: vi.fn().mockResolvedValue('@storybook/react-vite'),
			},
		};

		const description = await getToolDescription({
			origin: 'http://localhost:6006',
			options: mockOptions as any,
			disableTelemetry: true,
			a11yEnabled: true,
			toolsets: {
				dev: true,
				docs: true,
				test: false,
			},
		});

		expect(description).not.toContain('Running story tests or fixing test failures');
		expect(description).not.toContain(
			'Handling accessibility (a11y) violations in stories (fix semantic issues directly; ask before visual/design changes)',
		);
		expect(description).not.toContain('How to handle test failures');
	});

	it('should include testing but exclude a11y description when a11y is disabled', async () => {
		const mockOptions = {
			presets: {
				apply: vi.fn().mockResolvedValue('@storybook/react-vite'),
			},
		};

		const description = await getToolDescription({
			origin: 'http://localhost:6006',
			options: mockOptions as any,
			disableTelemetry: true,
			a11yEnabled: false,
			toolsets: {
				dev: true,
				docs: true,
				test: true,
			},
		});

		expect(description).toContain('Running story tests or fixing test failures');
		expect(description).toContain('How to handle test failures');
		expect(description).not.toContain('How to handle test failures and accessibility violations');
		expect(description).not.toContain(
			'Handling accessibility (a11y) violations in stories (fix semantic issues directly; ask before visual/design changes)',
		);
	});

	it('should return UI building instructions with framework placeholders replaced', async () => {
		const mockOptions = {
			presets: {
				apply: vi.fn().mockResolvedValue('@storybook/react-vite'),
			},
		};

		const testContext: AddonContext = {
			origin: 'http://localhost:6006',
			options: mockOptions as any,
			disableTelemetry: true,
		};

		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
				arguments: {},
			},
		};

		const response = await server.receive(request, {
			sessionId: 'test-session',
			custom: testContext,
		});

		const instructions = response.result?.content[0].text as string;

		// Check that placeholders were replaced
		expect(instructions).toContain('@storybook/react-vite');
		expect(instructions).toContain('@storybook/react');
		expect(instructions).toContain(PREVIEW_STORIES_TOOL_NAME);

		// Check that no placeholders remain
		expect(instructions).not.toContain('{{FRAMEWORK}}');
		expect(instructions).not.toContain('{{RENDERER}}');
		expect(instructions).not.toContain('{{PREVIEW_STORIES_TOOL_NAME}}');
	});

	it('should handle Vue framework', async () => {
		const mockOptions = {
			presets: {
				apply: vi.fn().mockResolvedValue('@storybook/vue3-vite'),
			},
		};

		const testContext: AddonContext = {
			origin: 'http://localhost:6006',
			options: mockOptions as any,
			disableTelemetry: true,
		};

		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
				arguments: {},
			},
		};

		const response = await server.receive(request, {
			sessionId: 'test-session',
			custom: testContext,
		});

		const instructions = response.result?.content[0].text as string;

		expect(instructions).toContain('@storybook/vue3-vite');
		expect(instructions).toContain('@storybook/vue3');
	});

	it('should handle framework as object with name property', async () => {
		const mockOptions = {
			presets: {
				apply: vi.fn().mockResolvedValue({
					name: '@storybook/nextjs',
					options: {},
				}),
			},
		};

		const testContext: AddonContext = {
			origin: 'http://localhost:6006',
			options: mockOptions as any,
			disableTelemetry: true,
		};

		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
				arguments: {},
			},
		};

		const response = await server.receive(request, {
			sessionId: 'test-session',
			custom: testContext,
		});

		const instructions = response.result?.content[0].text as string;

		expect(instructions).toContain('@storybook/nextjs');
		expect(instructions).toContain('@storybook/react');
	});

	it('should collect telemetry when enabled', async () => {
		const { telemetry } = await import('storybook/internal/telemetry');

		const mockOptions = {
			presets: {
				apply: vi.fn().mockResolvedValue('@storybook/react-vite'),
			},
		};

		const testContext: AddonContext = {
			origin: 'http://localhost:6006',
			options: mockOptions as any,
			disableTelemetry: false,
		};

		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
				arguments: {},
			},
		};

		await server.receive(request, {
			sessionId: 'test-session',
			custom: testContext,
		});

		expect(telemetry).toHaveBeenCalledWith(
			'addon-mcp',
			expect.objectContaining({
				event: 'tool:getUIBuildingInstructions',
				mcpSessionId: 'test-session',
				toolset: 'dev',
			}),
		);
	});

	it('should handle missing options in context', async () => {
		const testContext = {
			origin: 'http://localhost:6006',
			disableTelemetry: true,
		} as any;

		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: GET_UI_BUILDING_INSTRUCTIONS_TOOL_NAME,
				arguments: {},
			},
		};

		const response = await server.receive(request, {
			sessionId: 'test-session',
			custom: testContext,
		});

		expect(response.result).toEqual({
			content: [
				{
					type: 'text',
					text: 'Error: Options are required in addon context',
				},
			],
			isError: true,
		});
	});
});
