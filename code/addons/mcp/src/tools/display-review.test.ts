import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { addDisplayReviewTool, buildReviewUrl, type ReviewState } from './display-review.ts';
import { DISPLAY_REVIEW_TOOL_NAME } from './tool-names.ts';
import { PUSH_REVIEW_EVENT } from '../constants.ts';
import type { AddonContext } from '../types.ts';

const sampleReview: ReviewState = {
	title: 'Recolour the primary button',
	description: 'Button background changed from blue to green.',
	collections: [
		{
			title: 'Button',
			rationale: 'The directly changed component.',
			storyIds: ['button--primary', 'button--secondary'],
		},
		{
			title: 'Pages',
			rationale: 'Pages that render Button.',
			storyIds: ['page--home'],
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

	it('falls back to origin when the request URL is unparseable', () => {
		const badRequest = { url: '::::not a url' } as unknown as Request;
		expect(buildReviewUrl({ origin: 'http://localhost:6006', request: badRequest })).toBe(
			'http://localhost:6006/?path=/review/',
		);
	});

	it('handles a trailing slash on the request pathname', () => {
		expect(
			buildReviewUrl({
				origin: 'http://localhost:6006',
				request: new Request('https://example.com/storybook/mcp/'),
			}),
		).toBe('http://localhost:6006/storybook/?path=/review/');
	});

	it('strips a multi-segment endpoint with a trailing slash on the request', () => {
		expect(
			buildReviewUrl({
				origin: 'http://localhost:6006',
				request: new Request('https://example.com/api/mcp/'),
				endpoint: '/api/mcp',
			}),
		).toBe('http://localhost:6006/?path=/review/');
	});
});

describe('displayReviewTool', () => {
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
		const adapter = new ValibotJsonSchemaAdapter();
		server = new McpServer(
			{
				name: 'test-server',
				version: '1.0.0',
				description: 'Test server for display-review tool',
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

		await addDisplayReviewTool(server);
	});

	async function callTool(args: ReviewState, custom: AddonContext) {
		return server.receive(
			{
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: { name: DISPLAY_REVIEW_TOOL_NAME, arguments: args },
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

	it('returns the review URL and a human summary', async () => {
		const response = await callTool(sampleReview, makeContext());
		const result = getResult(response);

		expect(result?.isError).toBeFalsy();
		expect(result?.structuredContent?.reviewUrl).toBe('http://localhost:6006/?path=/review/');
		expect(result?.content?.[0]?.text).toContain('2 collections, 3 stories');
		expect(result?.content?.[0]?.text).toContain('http://localhost:6006/?path=/review/');
	});

	it('hands the payload off to addon-review via the PUSH_REVIEW channel event', async () => {
		await callTool(sampleReview, makeContext());
		expect(emitted).toEqual([{ event: PUSH_REVIEW_EVENT, payload: sampleReview }]);
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

	it('returns an MCP error when origin is missing from the addon context', async () => {
		const response = await callTool(sampleReview, {
			// Intentionally omit `origin` to exercise the error path.
			options: {} as unknown as AddonContext['options'],
			disableTelemetry: true,
		} as AddonContext);
		const result = getResult(response);

		expect(result?.isError).toBe(true);
		expect(result?.content?.[0]?.text).toMatch(/Cannot resolve the Storybook URL/);
		expect(emitted).toEqual([]);
	});
});
