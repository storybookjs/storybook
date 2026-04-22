import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { addGetChangedStoriesTool } from './get-changed-stories.ts';
import type { AddonContext } from '../types.ts';
import * as fetchStoryIndex from '../utils/fetch-story-index.ts';
import smallStoryIndexFixture from '../../fixtures/small-story-index.fixture.json' with { type: 'json' };
import { GET_CHANGED_STORIES_TOOL_NAME } from './tool-names.ts';

const { mockGetStatusStore } = vi.hoisted(() => ({
	mockGetStatusStore: vi.fn(),
}));

vi.mock('storybook/internal/core-server', () => ({
	experimental_getStatusStore: (...args: unknown[]) => mockGetStatusStore(...args),
}));

describe('getChangedStoriesTool', () => {
	let server: McpServer<unknown, AddonContext>;
	const testContext: AddonContext = {
		origin: 'http://localhost:6006',
		options: {} as AddonContext['options'],
		disableTelemetry: true,
	};

	beforeEach(async () => {
		mockGetStatusStore.mockReset();
		const adapter = new ValibotJsonSchemaAdapter();
		server = new McpServer(
			{
				name: 'test-server',
				version: '1.0.0',
				description: 'Test server for get-changed-stories tool',
			},
			{
				adapter,
				capabilities: {
					tools: { listChanged: true },
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

		await addGetChangedStoriesTool(server);
		vi.spyOn(fetchStoryIndex, 'fetchStoryIndex').mockResolvedValue(smallStoryIndexFixture);
	});

	it('returns required metadata fields and raw status values', async () => {
		mockGetStatusStore.mockReturnValue({
			getAllStatuses: () => ({
				'button--primary': {
					'storybook/change-detection': {
						value: 'status-value:new',
					},
				},
				'button--secondary': {
					'storybook/change-detection': {
						value: 'status-value:modified',
					},
				},
				'input--default': {
					'storybook/change-detection': {
						value: 'status-value:affected',
					},
				},
			}),
		});

		const response = await server.receive(
			{
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: GET_CHANGED_STORIES_TOOL_NAME,
					arguments: {},
				},
			},
			{
				sessionId: 'test-session',
				custom: testContext,
			},
		);

		expect(fetchStoryIndex.fetchStoryIndex).toHaveBeenCalledWith('http://localhost:6006');
		expect(response.result?.structuredContent).toEqual({
			stories: [
				{
					storyId: 'button--primary',
					title: 'Button',
					name: 'Primary',
					importPath: './src/Button.stories.tsx',
					statusValue: 'status-value:new',
				},
				{
					storyId: 'button--secondary',
					title: 'Button',
					name: 'Secondary',
					importPath: './src/Button.stories.tsx',
					statusValue: 'status-value:modified',
				},
				{
					storyId: 'input--default',
					title: 'Input',
					name: 'Default',
					importPath: './src/Input.stories.tsx',
					statusValue: 'status-value:affected',
				},
			],
			counts: {
				new: 1,
				modified: 1,
				affected: 1,
			},
		});
	});

	it('filters out unsupported status values', async () => {
		mockGetStatusStore.mockReturnValue({
			getAllStatuses: () => ({
				'button--primary': {
					'storybook/change-detection': {
						value: 'status-value:new',
					},
				},
				'button--secondary': {
					'storybook/change-detection': {
						value: 'status-value:success',
					},
				},
			}),
		});

		const response = await server.receive(
			{
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: { name: GET_CHANGED_STORIES_TOOL_NAME, arguments: {} },
			},
			{ sessionId: 'test-session', custom: testContext },
		);

		expect(response.result?.structuredContent?.stories).toHaveLength(1);
		expect(response.result?.structuredContent?.stories[0].storyId).toBe('button--primary');
	});

	it('sorts by new, modified, affected, then storyId', async () => {
		mockGetStatusStore.mockReturnValue({
			getAllStatuses: () => ({
				'input--default': {
					'storybook/change-detection': { value: 'status-value:affected' },
				},
				'button--secondary': {
					'storybook/change-detection': { value: 'status-value:new' },
				},
				'button--primary': {
					'storybook/change-detection': { value: 'status-value:new' },
				},
			}),
		});

		const response = await server.receive(
			{
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: { name: GET_CHANGED_STORIES_TOOL_NAME, arguments: {} },
			},
			{ sessionId: 'test-session', custom: testContext },
		);

		expect(
			response.result?.structuredContent?.stories.map((story: { storyId: string }) => story.storyId),
		).toEqual(['button--primary', 'button--secondary', 'input--default']);
	});

	it('uses fallbacks when a changed story is not in index', async () => {
		mockGetStatusStore.mockReturnValue({
			getAllStatuses: () => ({
				'missing--story': {
					'storybook/change-detection': { value: 'status-value:modified' },
				},
			}),
		});

		const response = await server.receive(
			{
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: { name: GET_CHANGED_STORIES_TOOL_NAME, arguments: {} },
			},
			{ sessionId: 'test-session', custom: testContext },
		);

		expect(response.result?.structuredContent?.stories[0]).toEqual({
			storyId: 'missing--story',
			title: 'Unknown title',
			name: 'Unknown story',
			importPath: 'Unknown import path',
			statusValue: 'status-value:modified',
		});
	});

	it('returns an MCP error when status store cannot be read', async () => {
		mockGetStatusStore.mockReturnValue({});

		const response = await server.receive(
			{
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: { name: GET_CHANGED_STORIES_TOOL_NAME, arguments: {} },
			},
			{ sessionId: 'test-session', custom: testContext },
		);

		expect(response.result).toEqual({
			content: [
				{
					type: 'text',
					text: 'Error: Storybook status store does not expose a readable all-statuses API',
				},
			],
			isError: true,
		});
	});
});
