import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { addPreviewStoriesTool } from './preview-stories.ts';
import type { AddonContext } from '../types.ts';
import smallStoryIndexFixture from '../../fixtures/small-story-index.fixture.json' with { type: 'json' };
import monorepoStoryIndexFixture from '../../fixtures/monorepo-story-index.fixture.json' with { type: 'json' };
import * as fetchStoryIndex from '../utils/fetch-story-index.ts';
import { PREVIEW_STORIES_TOOL_NAME } from './tool-names.ts';

vi.mock('storybook/internal/csf', () => ({
	storyNameFromExport: (exportName: string) => exportName,
}));

describe('previewStoriesTool', () => {
	let server: McpServer<any, AddonContext>;
	let fetchStoryIndexSpy: any;
	const testContext: AddonContext = {
		origin: 'http://localhost:6006',
		options: {} as any,
		disableTelemetry: true,
	};

	beforeEach(async () => {
		const adapter = new ValibotJsonSchemaAdapter();
		server = new McpServer(
			{
				name: 'test-server',
				version: '1.0.0',
				description: 'Test server for preview-stories tool',
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

		await addPreviewStoriesTool(server);

		// Mock fetchStoryIndex to return the fixture
		fetchStoryIndexSpy = vi.spyOn(fetchStoryIndex, 'fetchStoryIndex');
		fetchStoryIndexSpy.mockResolvedValue(smallStoryIndexFixture);
	});

	it('should return story URL for a valid story', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: PREVIEW_STORIES_TOOL_NAME,
				arguments: {
					stories: [
						{
							exportName: 'Primary',
							absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
						},
					],
				},
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
					text: 'http://localhost:6006/?path=/story/button--primary',
				},
			],
			structuredContent: {
				stories: [
					{
						title: 'Button',
						name: 'Primary',
						previewUrl: 'http://localhost:6006/?path=/story/button--primary',
					},
				],
			},
		});
		expect(fetchStoryIndexSpy).toHaveBeenCalledWith('http://localhost:6006');
	});

	it('should return story URL when input uses storyId', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: PREVIEW_STORIES_TOOL_NAME,
				arguments: {
					stories: [{ storyId: 'button--primary' }],
				},
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
					text: 'http://localhost:6006/?path=/story/button--primary',
				},
			],
			structuredContent: {
				stories: [
					{
						title: 'Button',
						name: 'Primary',
						previewUrl: 'http://localhost:6006/?path=/story/button--primary',
					},
				],
			},
		});
	});

	it('should return story URLs for multiple stories', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: PREVIEW_STORIES_TOOL_NAME,
				arguments: {
					stories: [
						{
							exportName: 'Primary',
							absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
						},
						{
							exportName: 'Secondary',
							absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
						},
						{
							exportName: 'Default',
							absoluteStoryPath: `${process.cwd()}/src/Input.stories.tsx`,
						},
					],
				},
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
					text: 'http://localhost:6006/?path=/story/button--primary',
				},
				{
					type: 'text',
					text: 'http://localhost:6006/?path=/story/button--secondary',
				},
				{
					type: 'text',
					text: 'http://localhost:6006/?path=/story/input--default',
				},
			],
			structuredContent: {
				stories: [
					{
						title: 'Button',
						name: 'Primary',
						previewUrl: 'http://localhost:6006/?path=/story/button--primary',
					},
					{
						title: 'Button',
						name: 'Secondary',
						previewUrl: 'http://localhost:6006/?path=/story/button--secondary',
					},
					{
						title: 'Input',
						name: 'Default',
						previewUrl: 'http://localhost:6006/?path=/story/input--default',
					},
				],
			},
		});
	});

	it('should return error message for story not found', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: PREVIEW_STORIES_TOOL_NAME,
				arguments: {
					stories: [
						{
							exportName: 'NonExistent',
							absoluteStoryPath: `${process.cwd()}/src/NonExistent.stories.tsx`,
						},
					],
				},
			},
		};

		const response = await server.receive(request, {
			sessionId: 'test-session',
			custom: testContext,
		});

		expect(response.result?.content[0].type).toBe('text');
		expect(response.result?.content[0].text).toContain('No story found');
		expect(response.result?.content[0].text).toContain('NonExistent');
		expect(response.result?.content[0].text).toContain(
			'did you forget to pass the explicit story name?',
		);
	});

	it('should handle explicit story names', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: PREVIEW_STORIES_TOOL_NAME,
				arguments: {
					stories: [
						{
							exportName: 'Primary',
							explicitStoryName: 'Primary',
							absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
						},
					],
				},
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
					text: 'http://localhost:6006/?path=/story/button--primary',
				},
			],
			structuredContent: {
				stories: [
					{
						title: 'Button',
						name: 'Primary',
						previewUrl: 'http://localhost:6006/?path=/story/button--primary',
					},
				],
			},
		});
	});

	it('should not include "forgot explicit story name" hint when explicitStoryName is provided', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: PREVIEW_STORIES_TOOL_NAME,
				arguments: {
					stories: [
						{
							exportName: 'NonExistent',
							explicitStoryName: 'NonExistent',
							absoluteStoryPath: `${process.cwd()}/src/NonExistent.stories.tsx`,
						},
					],
				},
			},
		};

		const response = await server.receive(request, {
			sessionId: 'test-session',
			custom: testContext,
		});

		expect(response.result?.content[0].text).toContain('No story found');
		expect(response.result?.content[0].text).not.toContain(
			'did you forget to pass the explicit story name?',
		);
	});

	it('should collect telemetry when enabled', async () => {
		const { telemetry } = await import('storybook/internal/telemetry');

		const telemetryContext = {
			origin: 'http://localhost:6006',
			options: {} as any,
			disableTelemetry: false,
		};

		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: PREVIEW_STORIES_TOOL_NAME,
				arguments: {
					stories: [
						{
							exportName: 'Primary',
							absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
						},
					],
				},
			},
		};

		await server.receive(request, {
			sessionId: 'test-session',
			custom: telemetryContext,
		});

		expect(telemetry).toHaveBeenCalledWith(
			'addon-mcp',
			expect.objectContaining({
				event: 'tool:previewStories',
				mcpSessionId: 'test-session',
				toolset: 'dev',
				inputStoryCount: 1,
				outputStoryCount: 1,
			}),
		);
	});

	it('should handle missing origin in context', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: PREVIEW_STORIES_TOOL_NAME,
				arguments: {
					stories: [
						{
							exportName: 'Primary',
							absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
						},
					],
				},
			},
		};

		const response = await server.receive(request, {
			sessionId: 'test-session',
			custom: {
				options: {} as any,
				disableTelemetry: true,
			} as any,
		});

		expect(response.result).toEqual({
			content: [
				{
					type: 'text',
					text: 'Error: Origin is required in addon context',
				},
			],
			isError: true,
		});
	});

	it('should handle fetch errors gracefully', async () => {
		fetchStoryIndexSpy.mockRejectedValue(new Error('Network timeout'));

		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: PREVIEW_STORIES_TOOL_NAME,
				arguments: {
					stories: [
						{
							exportName: 'Primary',
							absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
						},
					],
				},
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
					text: 'Error: Network timeout',
				},
			],
			isError: true,
		});
	});

	it('should include props as args query param in URL', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: PREVIEW_STORIES_TOOL_NAME,
				arguments: {
					stories: [
						{
							exportName: 'Primary',
							absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
							props: {
								label: 'Custom Label',
								disabled: true,
							},
						},
					],
				},
			},
		};

		const response = await server.receive(request, {
			sessionId: 'test-session',
			custom: testContext,
		});

		expect(response.result?.structuredContent?.stories[0]).toEqual({
			title: 'Button',
			name: 'Primary',
			previewUrl:
				'http://localhost:6006/?path=/story/button--primary&args=label:Custom+Label;disabled:!true',
		});
	});

	it('should include globals query param in URL', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: PREVIEW_STORIES_TOOL_NAME,
				arguments: {
					stories: [
						{
							exportName: 'Primary',
							absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
							globals: {
								theme: 'dark',
								locale: 'fr',
							},
						},
					],
				},
			},
		};

		const response = await server.receive(request, {
			sessionId: 'test-session',
			custom: testContext,
		});

		expect(response.result?.structuredContent?.stories[0]).toEqual({
			title: 'Button',
			name: 'Primary',
			previewUrl: 'http://localhost:6006/?path=/story/button--primary&globals=theme:dark;locale:fr',
		});
	});

	it('should include both props and globals query params in URL', async () => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: PREVIEW_STORIES_TOOL_NAME,
				arguments: {
					stories: [
						{
							exportName: 'Primary',
							absoluteStoryPath: `${process.cwd()}/src/Button.stories.tsx`,
							props: {
								label: 'Dark Mode Button',
							},
							globals: {
								theme: 'dark',
							},
						},
					],
				},
			},
		};

		const response = await server.receive(request, {
			sessionId: 'test-session',
			custom: testContext,
		});

		expect(response.result?.structuredContent?.stories[0]).toEqual({
			title: 'Button',
			name: 'Primary',
			previewUrl:
				'http://localhost:6006/?path=/story/button--primary&args=label:Dark+Mode+Button&globals=theme:dark',
		});
	});

	describe('Windows paths', () => {
		const originalCwd = process.cwd;
		const windowsCwd = 'C:\\Users\\test\\project';

		beforeEach(() => {
			// Mock process.cwd to return a Windows path
			Object.defineProperty(process, 'cwd', {
				value: () => windowsCwd,
				writable: true,
				configurable: true,
			});
		});

		afterEach(() => {
			// Restore original process.cwd
			Object.defineProperty(process, 'cwd', {
				value: originalCwd,
				writable: true,
				configurable: true,
			});
		});

		it('should return story URL for a valid story with Windows absolute path', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: PREVIEW_STORIES_TOOL_NAME,
					arguments: {
						stories: [
							{
								exportName: 'Primary',
								absoluteStoryPath: 'C:\\Users\\test\\project\\src\\Button.stories.tsx',
							},
						],
					},
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
						text: 'http://localhost:6006/?path=/story/button--primary',
					},
				],
				structuredContent: {
					stories: [
						{
							title: 'Button',
							name: 'Primary',
							previewUrl: 'http://localhost:6006/?path=/story/button--primary',
						},
					],
				},
			});
			expect(fetchStoryIndexSpy).toHaveBeenCalledWith('http://localhost:6006');
		});

		it('should return error message for story not found with Windows path', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: PREVIEW_STORIES_TOOL_NAME,
					arguments: {
						stories: [
							{
								exportName: 'NonExistent',
								absoluteStoryPath: 'C:\\Users\\test\\project\\src\\NonExistent.stories.tsx',
							},
						],
					},
				},
			};

			const response = await server.receive(request, {
				sessionId: 'test-session',
				custom: testContext,
			});

			expect(response.result?.content[0].type).toBe('text');
			expect(response.result?.content[0].text).toContain('No story found');
			expect(response.result?.content[0].text).toContain('NonExistent');
			expect(response.result?.content[0].text).toContain(
				'did you forget to pass the explicit story name?',
			);
		});

		it('should handle Windows path with mixed forward and backslashes', async () => {
			const request = {
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: PREVIEW_STORIES_TOOL_NAME,
					arguments: {
						stories: [
							{
								exportName: 'Primary',
								absoluteStoryPath: 'C:/Users/test/project/src/Button.stories.tsx',
							},
						],
					},
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
						text: 'http://localhost:6006/?path=/story/button--primary',
					},
				],
				structuredContent: {
					stories: [
						{
							title: 'Button',
							name: 'Primary',
							previewUrl: 'http://localhost:6006/?path=/story/button--primary',
						},
					],
				},
			});
		});
	});

	describe('Monorepo path resolution', () => {
		it('should match stories when index.json importPath has no leading ./', async () => {
			// Simulate monorepo setup where Storybook runs from apps/storybook
			// but stories live in packages/ — index.json uses ../../packages/...
			fetchStoryIndexSpy.mockResolvedValue(monorepoStoryIndexFixture);

			const request = {
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: PREVIEW_STORIES_TOOL_NAME,
					arguments: {
						stories: [
							{
								exportName: 'Primary',
								absoluteStoryPath: `${process.cwd()}/../../packages/design-system/components/Button/Button.stories.tsx`,
							},
						],
					},
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
						text: 'http://localhost:6006/?path=/story/design-system-components-button--primary',
					},
				],
				structuredContent: {
					stories: [
						{
							title: 'Design System / Components / Button',
							name: 'Primary',
							previewUrl:
								'http://localhost:6006/?path=/story/design-system-components-button--primary',
						},
					],
				},
			});
		});

		it('should match stories when both index.json importPath and computed path have leading ./ and normalization still works', async () => {
			// Simulate running Storybook from root where index.json uses ./stories/...
			// The computed relative path also starts with ./stories/... and normalization preserves the match
			fetchStoryIndexSpy.mockResolvedValue(monorepoStoryIndexFixture);

			const request = {
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: PREVIEW_STORIES_TOOL_NAME,
					arguments: {
						stories: [
							{
								exportName: 'Primary',
								absoluteStoryPath: `${process.cwd()}/stories/Button.stories.tsx`,
							},
						],
					},
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
						text: 'http://localhost:6006/?path=/story/app-stories-button--primary',
					},
				],
				structuredContent: {
					stories: [
						{
							title: 'App / Button',
							name: 'Primary',
							previewUrl: 'http://localhost:6006/?path=/story/app-stories-button--primary',
						},
					],
				},
			});
		});

		it('should match stories when index.json importPath has no ./ and computed path has ./', async () => {
			// index.json stores "stories/Utils/Helpers.stories.tsx" (no ./ prefix)
			// computed relative path would be "./stories/Utils/Helpers.stories.tsx"
			fetchStoryIndexSpy.mockResolvedValue(monorepoStoryIndexFixture);

			const request = {
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: PREVIEW_STORIES_TOOL_NAME,
					arguments: {
						stories: [
							{
								exportName: 'Default',
								absoluteStoryPath: `${process.cwd()}/stories/Utils/Helpers.stories.tsx`,
							},
						],
					},
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
						text: 'http://localhost:6006/?path=/story/utils-helpers--default',
					},
				],
				structuredContent: {
					stories: [
						{
							title: 'Utils / Helpers',
							name: 'Default',
							previewUrl: 'http://localhost:6006/?path=/story/utils-helpers--default',
						},
					],
				},
			});
		});

		it('should match stories when path has dot-segments like ./stories/../stories/', async () => {
			// dot-segments should be canonicalized: ./stories/../stories/Button.stories.tsx -> ./stories/Button.stories.tsx
			fetchStoryIndexSpy.mockResolvedValue(monorepoStoryIndexFixture);

			const request = {
				jsonrpc: '2.0' as const,
				id: 1,
				method: 'tools/call',
				params: {
					name: PREVIEW_STORIES_TOOL_NAME,
					arguments: {
						stories: [
							{
								exportName: 'Primary',
								absoluteStoryPath: `${process.cwd()}/stories/../stories/Button.stories.tsx`,
							},
						],
					},
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
						text: 'http://localhost:6006/?path=/story/app-stories-button--primary',
					},
				],
				structuredContent: {
					stories: [
						{
							title: 'App / Button',
							name: 'Primary',
							previewUrl: 'http://localhost:6006/?path=/story/app-stories-button--primary',
						},
					],
				},
			});
		});
	});
});
