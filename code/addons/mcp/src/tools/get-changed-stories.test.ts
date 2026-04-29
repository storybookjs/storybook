import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { addGetChangedStoriesTool } from './get-changed-stories.ts';
import type { AddonContext } from '../types.ts';
import * as fetchStoryIndex from '../utils/fetch-story-index.ts';
import smallStoryIndexFixture from '../../fixtures/small-story-index.fixture.json' with { type: 'json' };
import { GET_CHANGED_STORIES_TOOL_NAME } from './tool-names.ts';
import type { StoryIndex } from 'storybook/internal/types';

const { mockGetStatusStore } = vi.hoisted(() => ({
	mockGetStatusStore: vi.fn(),
}));

vi.mock('storybook/manager-api', () => ({
	experimental_getStatusStore: (...args: unknown[]) => mockGetStatusStore(...args),
}));

describe('getChangedStoriesTool', () => {
	let server: McpServer<any, AddonContext>;
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
		vi.spyOn(fetchStoryIndex, 'fetchStoryIndex').mockResolvedValue(
			smallStoryIndexFixture as unknown as StoryIndex,
		);
	});

	async function callTool() {
		return server.receive(
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
	}

	function getResultText(response: unknown): string {
		if (!response || typeof response !== 'object') return '';
		const result = (response as { result?: { content?: Array<{ text?: string }> } }).result;
		return result?.content?.[0]?.text ?? '';
	}

	it('returns grouped markdown text with changed story metadata', async () => {
		mockGetStatusStore.mockReturnValue({
			getAll: () => ({
				'button--primary': {
					'storybook/change-detection': {
						value: 'status-value:new',
						storyId: 'button--primary',
					},
				},
				'button--secondary': {
					'storybook/change-detection': {
						value: 'status-value:modified',
						storyId: 'button--secondary',
					},
				},
				'input--default': {
					'storybook/change-detection': {
						value: 'status-value:affected',
						storyId: 'input--default',
					},
				},
			}),
		});

		const response = await callTool();
		const text = getResultText(response);

		expect(fetchStoryIndex.fetchStoryIndex).toHaveBeenCalledWith('http://localhost:6006');
		expect(text).toMatchInlineSnapshot(`
			"Detected 3 changed stories (1 new, 1 modified, 1 related).

			New stories:
			- \`button--primary\`: Button / Primary (\`./src/Button.stories.tsx\`)

			Modified stories:
			- \`button--secondary\`: Button / Secondary (\`./src/Button.stories.tsx\`)

			Related stories:
			- \`input--default\`: Input / Default (\`./src/Input.stories.tsx\`)"
		`);
	});

	it('filters out unsupported status values', async () => {
		mockGetStatusStore.mockReturnValue({
			getAll: () => ({
				'button--primary': {
					'storybook/change-detection': {
						value: 'status-value:new',
						storyId: 'button--primary',
					},
				},
				'button--secondary': {
					'storybook/change-detection': {
						value: 'status-value:success',
						storyId: 'button--secondary',
					},
				},
			}),
		});

		const response = await callTool();
		const text = getResultText(response);

		expect(text).toMatchInlineSnapshot(`
			"Detected 1 changed story (1 new, 0 modified, 0 related).

			New stories:
			- \`button--primary\`: Button / Primary (\`./src/Button.stories.tsx\`)"
		`);
	});

	it('groups by new, modified, related, then sorts by storyId', async () => {
		mockGetStatusStore.mockReturnValue({
			getAll: () => ({
				'input--default': {
					'storybook/change-detection': {
						value: 'status-value:affected',
						storyId: 'input--default',
					},
				},
				'button--secondary': {
					'storybook/change-detection': {
						value: 'status-value:new',
						storyId: 'button--secondary',
					},
				},
				'button--primary': {
					'storybook/change-detection': {
						value: 'status-value:new',
						storyId: 'button--primary',
					},
				},
			}),
		});

		const response = await callTool();
		const text = getResultText(response);

		expect(text).toMatchInlineSnapshot(`
			"Detected 3 changed stories (2 new, 0 modified, 1 related).

			New stories:
			- \`button--primary\`: Button / Primary (\`./src/Button.stories.tsx\`)
			- \`button--secondary\`: Button / Secondary (\`./src/Button.stories.tsx\`)

			Related stories:
			- \`input--default\`: Input / Default (\`./src/Input.stories.tsx\`)"
		`);
	});

	it('supports getAll() status-store API', async () => {
		mockGetStatusStore.mockReturnValue({
			getAll: () => ({
				'button--primary': {
					'storybook/change-detection': {
						value: 'status-value:new',
						storyId: 'button--primary',
					},
				},
			}),
		});

		const response = await callTool();
		const text = getResultText(response);

		expect(text).toContain('Detected 1 changed story (1 new, 0 modified, 0 related).');
		expect(text).toContain('- `button--primary`: Button / Primary (`./src/Button.stories.tsx`)');
	});

	it('supports getAll() for modified stories', async () => {
		mockGetStatusStore.mockReturnValue({
			getAll: () => ({
				'button--secondary': {
					'storybook/change-detection': {
						value: 'status-value:modified',
						storyId: 'button--secondary',
					},
				},
			}),
		});

		const response = await callTool();
		const text = getResultText(response);

		expect(text).toContain('Detected 1 changed story (0 new, 1 modified, 0 related).');
		expect(text).toContain(
			'- `button--secondary`: Button / Secondary (`./src/Button.stories.tsx`)',
		);
	});

	it('uses fallbacks when a changed story is not in index', async () => {
		mockGetStatusStore.mockReturnValue({
			getAll: () => ({
				'missing--story': {
					'storybook/change-detection': {
						value: 'status-value:modified',
						storyId: 'missing--story',
					},
				},
			}),
		});

		const response = await callTool();
		const text = getResultText(response);

		expect(text).toMatchInlineSnapshot(`
			"Detected 1 changed story (0 new, 1 modified, 0 related).

			Modified stories:
			- \`missing--story\`"
		`);
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
					text: 'Error: statusStore.getAll is not a function',
				},
			],
			isError: true,
		});
	});

	it('returns early without fetching index when there are no relevant changed statuses', async () => {
		mockGetStatusStore.mockReturnValue({
			getAll: () => ({
				'button--primary': {
					'storybook/change-detection': {
						value: 'status-value:success',
						storyId: 'button--primary',
					},
				},
			}),
		});

		const callCountBefore = vi.mocked(fetchStoryIndex.fetchStoryIndex).mock.calls.length;
		const response = await callTool();
		const text = getResultText(response);

		expect(text).toBe('No new, modified, or related stories detected.');
		expect(vi.mocked(fetchStoryIndex.fetchStoryIndex).mock.calls.length).toBe(callCountBefore);
	});
});
