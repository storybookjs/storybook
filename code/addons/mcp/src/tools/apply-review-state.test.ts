import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { addApplyReviewStateTool, buildReviewUrl } from './apply-review-state.ts';
import { APPLY_REVIEW_STATE_TOOL_NAME } from './tool-names.ts';
import { APPLY_REVIEW_STATE_EVENT } from '../constants.ts';
import { getReviewState, type ReviewState } from '../review-state-store.ts';
import type { AddonContext } from '../types.ts';

// The tool resolves the target repo's git branch server-side. Mock it so
// the unit tests don't depend on the branch this repo happens to be on.
const { mockCurrentGitBranch } = vi.hoisted(() => ({ mockCurrentGitBranch: vi.fn() }));
vi.mock('../utils/git-branch.ts', () => ({
	currentGitBranch: (...args: unknown[]) => mockCurrentGitBranch(...args),
}));

const sampleReview: ReviewState = {
	title: 'Recolour the primary button',
	description: 'Button background changed from blue to green.',
	collections: [
		{
			title: 'Button',
			rationale: 'The directly changed component.',
			storyIds: ['button--primary', 'button--secondary'],
			kind: 'atomic',
		},
		{
			title: 'Pages',
			rationale: 'Pages that render Button.',
			storyIds: ['page--home'],
			kind: 'transitive',
		},
	],
	changedFiles: ['src/Button.tsx'],
};

describe('buildReviewUrl', () => {
	it('falls back to origin when there is no request', () => {
		expect(buildReviewUrl({ origin: 'http://localhost:6006' })).toBe(
			'http://localhost:6006/?path=/review/',
		);
	});

	it('uses the configured endpoint to recover a proxied Storybook root', () => {
		expect(
			buildReviewUrl({
				origin: 'http://localhost:6006',
				request: new Request('https://example.com/storybook/custom-mcp'),
				endpoint: '/custom-mcp',
			}),
		).toBe('http://localhost:6006/storybook/?path=/review/');
	});

	it('does not trust request host when origin is available', () => {
		expect(
			buildReviewUrl({
				origin: 'http://localhost:6006',
				request: new Request('https://evil.example.org/prefix/mcp'),
			}),
		).toBe('http://localhost:6006/prefix/?path=/review/');
	});

	it('throws when neither request nor origin is available', () => {
		expect(() => buildReviewUrl({} as any)).toThrow(/Cannot resolve the Storybook URL/);
	});
});

describe('applyReviewStateTool', () => {
	let server: McpServer<any, AddonContext>;
	let emitted: Array<{ event: string; payload: unknown }>;

	function makeContext(overrides: Partial<AddonContext> = {}): AddonContext {
		return {
			origin: 'http://localhost:6006',
			options: {
				channel: {
					emit: (event: string, payload: unknown) => emitted.push({ event, payload }),
				},
			} as unknown as AddonContext['options'],
			disableTelemetry: true,
			...overrides,
		};
	}

	beforeEach(async () => {
		emitted = [];
		mockCurrentGitBranch.mockReset();
		mockCurrentGitBranch.mockResolvedValue(undefined);
		const adapter = new ValibotJsonSchemaAdapter();
		server = new McpServer(
			{
				name: 'test-server',
				version: '1.0.0',
				description: 'Test server for apply-review-state tool',
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
			{ sessionId: 'test-session' },
		);

		await addApplyReviewStateTool(server);
	});

	async function callTool(args: ReviewState, custom: AddonContext) {
		return server.receive(
			{
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: { name: APPLY_REVIEW_STATE_TOOL_NAME, arguments: args },
			},
			{ sessionId: 'test-session', custom },
		);
	}

	function getResult(response: unknown) {
		return (
			response as {
				result?: {
					content?: Array<{ text?: string }>;
					structuredContent?: { reviewUrl?: string };
					isError?: boolean;
				};
			}
		).result;
	}

	it('stores the review state and returns the review URL', async () => {
		const response = await callTool(sampleReview, makeContext());
		const result = getResult(response);

		expect(result?.isError).toBeFalsy();
		expect(result?.structuredContent?.reviewUrl).toBe('http://localhost:6006/?path=/review/');
		expect(result?.content?.[0]?.text).toContain('2 collections, 3 stories');
		expect(result?.content?.[0]?.text).toContain('http://localhost:6006/?path=/review/');
		expect(getReviewState()).toEqual(sampleReview);
	});

	it('broadcasts the review over the Storybook channel', async () => {
		await callTool(sampleReview, makeContext());
		expect(emitted).toContainEqual({ event: APPLY_REVIEW_STATE_EVENT, payload: sampleReview });
	});

	it('builds a subpath-aware review URL from the incoming request', async () => {
		const response = await callTool(
			sampleReview,
			makeContext({ request: new Request('https://sb.example.com/design-system/mcp') }),
		);
		const result = getResult(response);

		expect(result?.structuredContent?.reviewUrl).toBe(
			'http://localhost:6006/design-system/?path=/review/',
		);
	});

	it('attaches the target repo git branch resolved server-side', async () => {
		mockCurrentGitBranch.mockResolvedValue('feature/badge-pink');

		await callTool(sampleReview, makeContext());

		const expected = { ...sampleReview, branchName: 'feature/badge-pink' };
		expect(getReviewState()).toEqual(expected);
		expect(emitted).toContainEqual({ event: APPLY_REVIEW_STATE_EVENT, payload: expected });
	});
});
