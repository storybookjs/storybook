import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { addGetChangedStoriesTool } from './get-changed-stories.ts';
import type { AddonContext } from '../types.ts';
import * as getStoryIndexModule from '../utils/get-story-index.ts';
import smallStoryIndexFixture from '../../fixtures/small-story-index.fixture.json' with { type: 'json' };
import { GET_CHANGED_STORIES_TOOL_NAME } from './tool-names.ts';
import type { StoryIndex } from 'storybook/internal/types';

const { mockGetStatusStore, mockGetActiveStoryDependencyGraphService, mockExecSync } = vi.hoisted(
	() => ({
		mockGetStatusStore: vi.fn<(...args: any[]) => any>(),
		// Defaults to "service inactive" — tests exercising the unreachable-files
		// path override this with `mockGetActiveStoryDependencyGraphService.mockReturnValue`.
		mockGetActiveStoryDependencyGraphService: vi.fn<(...args: any[]) => any>(),
		// Hoisted because node:child_process is loaded inside
		// detect-unreachable-changes.ts at module-eval time; ESM forbids
		// retroactive vi.spyOn.
		mockExecSync: vi.fn<(...args: any[]) => any>(),
	}),
);

vi.mock('storybook/internal/core-server', () => ({
	experimental_getStatusStore: (...args: unknown[]) => mockGetStatusStore(...args),
	// `get-changed-stories` calls this via `detectUnreachableChanges` to surface
	// modified working-tree files that aren't reached from any story root.
	experimental_getDependencyGraphService: (...args: unknown[]) =>
		mockGetActiveStoryDependencyGraphService(...args),
}));

vi.mock('node:child_process', async () => {
	const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
	return { ...actual, execSync: (...args: unknown[]) => mockExecSync(...(args as [])) };
});

describe('getChangedStoriesTool', () => {
	let server: McpServer<any, AddonContext>;
	const testContext: AddonContext = {
		origin: 'http://localhost:6006',
		options: {} as AddonContext['options'],
		disableTelemetry: true,
	};

	beforeEach(async () => {
		mockGetStatusStore.mockReset();
		mockGetActiveStoryDependencyGraphService.mockReset();
		mockGetActiveStoryDependencyGraphService.mockReturnValue(undefined);
		mockExecSync.mockReset();
		mockExecSync.mockReturnValue('');
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
		vi.spyOn(getStoryIndexModule, 'getStoryIndex').mockResolvedValue(
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

		expect(getStoryIndexModule.getStoryIndex).toHaveBeenCalledWith(testContext.options);
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

	it('omits changed stories that are not in the index', async () => {
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

		expect(text).toMatchInlineSnapshot(
			`"Detected 0 changed stories (0 new, 0 modified, 0 related)."`,
		);
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

		const callCountBefore = vi.mocked(getStoryIndexModule.getStoryIndex).mock.calls.length;
		const response = await callTool();
		const text = getResultText(response);

		expect(text).toBe('No new, modified, or related stories detected.');
		expect(vi.mocked(getStoryIndexModule.getStoryIndex).mock.calls.length).toBe(callCountBefore);
	});

	it('appends an unreachable-files hint to the empty response when the working tree has uncommitted source files outside the story graph', async () => {
		// The "theme-token edit" case: the agent changed a file that isn't
		// reached from any story root, so the status store is empty. Without
		// this hint the agent reads "no impact" and stops — the original
		// hallucination this whole feature exists to prevent.
		mockGetStatusStore.mockReturnValue({ getAll: () => ({}) });
		mockGetActiveStoryDependencyGraphService.mockReturnValue({
			hasGraph: () => true,
			// theme.ts is modified but no story file imports it.
			lookup: (_dep: string) => new Map(),
		});
		mockExecSync.mockReturnValue(' M src/styles/theme.ts\n');

		const response = await callTool();
		const text = getResultText(response);

		expect(text).toContain('No new, modified, or related stories detected.');
		expect(text).toContain('src/styles/theme.ts');
		expect(text).toMatch(/unreachable/i);
		expect(text).toContain('get-stories-by-component');
	});

	it('front-loads a coverage-gap banner AND appends a sanity-check hint when results coexist with unreachable working-tree files', async () => {
		// Belt-and-braces: long story lists (Chromatic-scale) can run past
		// host-side tool-output truncation caps, dropping the trailing hint.
		// The leading banner is the short, survivable salience aid; the tail
		// hint stays for agents that read in full.
		mockGetStatusStore.mockReturnValue({
			getAll: () => ({
				'button--primary': {
					'storybook/change-detection': {
						value: 'status-value:modified',
						storyId: 'button--primary',
					},
				},
			}),
		});
		mockGetActiveStoryDependencyGraphService.mockReturnValue({
			hasGraph: () => true,
			lookup: () => new Map(),
		});
		mockExecSync.mockReturnValue(' M .storybook/main.ts\n M src/server.ts\n');

		const response = await callTool();
		const text = getResultText(response);

		const bannerIdx = text.indexOf('Coverage gap');
		const headlineIdx = text.indexOf('Detected');
		expect(bannerIdx).toBeGreaterThanOrEqual(0);
		expect(bannerIdx).toBeLessThan(headlineIdx);
		expect(text).toContain('.storybook/main.ts');
		expect(text).toContain('src/server.ts');
		// And the long-form sanity-check hint still trails the bullet list,
		// so agents that read in full get the explanatory paragraph.
		expect(text).toMatch(/coverage sanity check/i);
	});

	it('omits both callouts when nothing in the working tree is unreachable', async () => {
		mockGetStatusStore.mockReturnValue({
			getAll: () => ({
				'button--primary': {
					'storybook/change-detection': {
						value: 'status-value:modified',
						storyId: 'button--primary',
					},
				},
			}),
		});
		mockGetActiveStoryDependencyGraphService.mockReturnValue({
			hasGraph: () => true,
			// Every modified file IS in the graph — no unreachable callout fires.
			lookup: () => new Map([['/repo/src/Button.stories.tsx', 1]]),
		});
		mockExecSync.mockReturnValue(' M src/Button.tsx\n');

		const response = await callTool();
		const text = getResultText(response);

		expect(text).not.toContain('Coverage gap');
		expect(text).not.toMatch(/coverage sanity check/i);
		expect(text.startsWith('Detected')).toBe(true);
	});
});
