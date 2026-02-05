import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { McpServer } from 'tmcp';
import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { addRunStoryTestsTool, getAddonVitestConstants } from './run-story-tests.ts';
import type { AddonContext } from '../types.ts';
import smallStoryIndexFixture from '../../fixtures/small-story-index.fixture.json' with { type: 'json' };
import * as fetchStoryIndex from '../utils/fetch-story-index.ts';
import type { TriggerTestRunResponsePayload } from '@storybook/addon-vitest/constants';
import { RUN_STORY_TESTS_TOOL_NAME } from './tool-names.ts';

vi.mock('storybook/internal/csf', () => ({
	storyNameFromExport: (exportName: string) => exportName,
}));

vi.mock('storybook/internal/node-logger', () => ({
	logger: {
		info: vi.fn(),
		debug: vi.fn(),
		warn: vi.fn(),
	},
}));

describe('getAddonVitestConstants', () => {
	it('should return constants when addon-vitest is available', async () => {
		const constants = await getAddonVitestConstants();
		expect(constants).toMatchInlineSnapshot(`
			{
			  "TRIGGER_TEST_RUN_REQUEST": "storybook/test/trigger-test-run-request",
			  "TRIGGER_TEST_RUN_RESPONSE": "storybook/test/trigger-test-run-response",
			}
		`);
	});
});

describe('runStoryTestsTool', () => {
	let server: McpServer<any, AddonContext>;
	let mockChannel: {
		on: Mock;
		off: Mock;
		emit: Mock;
	};

	type ChannelResponse = Omit<TriggerTestRunResponsePayload, 'requestId'>;

	const createTestContext = (): AddonContext => {
		mockChannel = {
			on: vi.fn(),
			off: vi.fn(),
			emit: vi.fn(),
		};

		return {
			origin: 'http://localhost:6006',
			options: {
				channel: mockChannel,
			} as any,
			disableTelemetry: true,
			toolsets: {
				dev: true,
				docs: true,
				test: true,
			},
		};
	};

	/**
	 * Sets up the mock channel to respond with the given response when a test run is triggered.
	 */
	const setupChannelResponse = (response: ChannelResponse) => {
		mockChannel.emit.mockImplementation((event, payload: any) => {
			if (event === 'storybook/test/trigger-test-run-request') {
				const onCallback = mockChannel.on.mock.calls.find(
					(call) => call[0] === 'storybook/test/trigger-test-run-response',
				)?.[1];
				if (onCallback) {
					setTimeout(() => {
						onCallback({
							requestId: payload.requestId,
							...response,
						});
					}, 0);
				}
			}
		});
	};

	/**
	 * Calls the run-story-tests tool with the given stories.
	 * Uses relative paths from 'src/' to avoid absolute path issues in snapshots.
	 */
	const callTool = async (
		stories: Array<{ exportName: string; relativePath: string }>,
		context: AddonContext,
	) => {
		const request = {
			jsonrpc: '2.0' as const,
			id: 1,
			method: 'tools/call',
			params: {
				name: RUN_STORY_TESTS_TOOL_NAME,
				arguments: {
					stories: stories.map((s) => ({
						exportName: s.exportName,
						absoluteStoryPath: `${process.cwd()}/${s.relativePath}`,
					})),
				},
			},
		};

		return server.receive(request, {
			sessionId: 'test-session',
			custom: context,
		});
	};

	beforeEach(async () => {
		vi.clearAllMocks();

		const adapter = new ValibotJsonSchemaAdapter();
		server = new McpServer(
			{
				name: 'test-server',
				version: '1.0.0',
				description: 'Test server for run-story-tests tool',
			},
			{
				adapter,
				capabilities: {
					tools: { listChanged: true },
				},
			},
		).withContext<AddonContext>();

		// Initialize test session
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

		await addRunStoryTestsTool(server);

		// Mock fetchStoryIndex to return the fixture
		vi.spyOn(fetchStoryIndex, 'fetchStoryIndex').mockResolvedValue(smallStoryIndexFixture as any);
	});

	it('should return passing stories when all tests pass', async () => {
		const testContext = createTestContext();

		setupChannelResponse({
			status: 'completed',
			result: {
				triggeredBy: 'external:addon-mcp',
				config: { coverage: false, a11y: false },
				storyIds: ['button--primary'],
				totalTestCount: 1,
				startedAt: Date.now(),
				finishedAt: Date.now(),
				coverageSummary: undefined,
				componentTestCount: { success: 1, error: 0 },
				a11yCount: { success: 1, warning: 0, error: 0 },
				componentTestStatuses: [
					{
						storyId: 'button--primary',
						typeId: 'storybook/component-test',
						value: 'status-value:success',
						title: 'Component Test',
						description: '',
					},
				],
				a11yStatuses: [],
				a11yReports: {},
				unhandledErrors: [],
			},
		});

		const response = await callTool(
			[{ exportName: 'Primary', relativePath: 'src/Button.stories.tsx' }],
			testContext,
		);

		expect(response.result?.content[0].text).toMatchInlineSnapshot(`
			"## Passing Stories

			- button--primary"
		`);
		expect(mockChannel.emit).toHaveBeenCalledWith(
			'storybook/test/trigger-test-run-request',
			expect.objectContaining({
				actor: 'addon-mcp',
				storyIds: ['button--primary'],
			}),
		);
	});

	it('should return failing stories with descriptions', async () => {
		const testContext = createTestContext();

		setupChannelResponse({
			status: 'completed',
			result: {
				triggeredBy: 'external:addon-mcp',
				config: { coverage: false, a11y: false },
				storyIds: ['button--primary'],
				totalTestCount: 1,
				startedAt: Date.now(),
				finishedAt: Date.now(),
				coverageSummary: undefined,
				componentTestCount: { success: 0, error: 1 },
				a11yCount: { success: 0, warning: 0, error: 0 },
				componentTestStatuses: [
					{
						storyId: 'button--primary',
						typeId: 'storybook/component-test',
						value: 'status-value:error',
						title: 'Component Test',
						description: 'Expected element to be visible',
					},
				],
				a11yStatuses: [],
				a11yReports: {},
				unhandledErrors: [],
			},
		});

		const response = await callTool(
			[{ exportName: 'Primary', relativePath: 'src/Button.stories.tsx' }],
			testContext,
		);

		expect(response.result?.content[0].text).toMatchInlineSnapshot(`
			"## Failing Stories

			### button--primary

			Expected element to be visible"
		`);
	});

	it('should show both passing and failing stories when there are mixed results', async () => {
		const testContext = createTestContext();

		setupChannelResponse({
			status: 'completed',
			result: {
				triggeredBy: 'external:addon-mcp',
				config: { coverage: false, a11y: false },
				storyIds: ['button--primary', 'button--secondary'],
				totalTestCount: 2,
				startedAt: Date.now(),
				finishedAt: Date.now(),
				coverageSummary: undefined,
				componentTestCount: { success: 1, error: 1 },
				a11yCount: { success: 0, warning: 0, error: 0 },
				componentTestStatuses: [
					{
						storyId: 'button--primary',
						typeId: 'storybook/component-test',
						value: 'status-value:success',
						title: 'Component Test',
						description: '',
					},
					{
						storyId: 'button--secondary',
						typeId: 'storybook/component-test',
						value: 'status-value:error',
						title: 'Component Test',
						description: 'Expected button text to be "Secondary"',
					},
				],
				a11yStatuses: [],
				a11yReports: {},
				unhandledErrors: [],
			},
		});

		const response = await callTool(
			[{ exportName: 'Primary', relativePath: 'src/Button.stories.tsx' }],
			testContext,
		);

		expect(response.result?.content[0].text).toMatchInlineSnapshot(`
			"## Passing Stories

			- button--primary

			## Failing Stories

			### button--secondary

			Expected button text to be \"Secondary\""
		`);
	});

	it('should include a11y violations in results', async () => {
		const testContext = createTestContext();

		setupChannelResponse({
			status: 'completed',
			result: {
				triggeredBy: 'external:addon-mcp',
				config: { coverage: false, a11y: true },
				storyIds: ['button--primary'],
				totalTestCount: 1,
				startedAt: Date.now(),
				finishedAt: Date.now(),
				coverageSummary: undefined,
				componentTestCount: { success: 1, error: 0 },
				a11yCount: { success: 0, warning: 1, error: 1 },
				componentTestStatuses: [
					{
						storyId: 'button--primary',
						typeId: 'storybook/component-test',
						value: 'status-value:success',
						title: 'Component Test',
						description: '',
					},
				],
				a11yStatuses: [],
				a11yReports: {
					'button--primary': [
						{
							violations: [
								{
									id: 'color-contrast',
									description: 'Color contrast ratio is insufficient',
									nodes: [
										{
											html: '<button style="color: #fff; background: #ccc;">Click me</button>',
											impact: 'critical',
											failureSummary: '2.5:1 (required: 4.5:1)',
											linkPath: '/inspect/button--primary?inspectPath=button.0',
										},
									],
								},
							],
						},
					],
				},
				unhandledErrors: [],
			},
		});

		const response = await callTool(
			[{ exportName: 'Primary', relativePath: 'src/Button.stories.tsx' }],
			testContext,
		);

		expect(response.result?.content[0].text).toMatchInlineSnapshot(`
			"## Passing Stories

			- button--primary

			## Accessibility Violations

			### button--primary - color-contrast

			Color contrast ratio is insufficient

			#### Affected Elements
			- **Impact**: critical
			  **Message**: 2.5:1 (required: 4.5:1)
			  **Element**: <button style="color: #fff; background: #ccc;">Click me</button>
			  **Inspect**: http://localhost:6006/inspect/button--primary?inspectPath=button.0"
		`);
	});

	it('should handle unhandled errors', async () => {
		const testContext = createTestContext();

		setupChannelResponse({
			status: 'completed',
			result: {
				triggeredBy: 'external:addon-mcp',
				config: { coverage: false, a11y: false },
				storyIds: ['button--primary'],
				totalTestCount: 1,
				startedAt: Date.now(),
				finishedAt: Date.now(),
				coverageSummary: undefined,
				componentTestCount: { success: 0, error: 1 },
				a11yCount: { success: 0, warning: 0, error: 0 },
				componentTestStatuses: [],
				a11yStatuses: [],
				a11yReports: {},
				unhandledErrors: [
					{
						name: 'ReferenceError',
						message: 'foo is not defined',
						stack: 'ReferenceError: foo is not defined\n    at Button.tsx:10:5',
						VITEST_TEST_PATH: '/src/Button.stories.tsx',
						VITEST_TEST_NAME: 'Button > Primary',
					},
				],
			},
		});

		const response = await callTool(
			[{ exportName: 'Primary', relativePath: 'src/Button.stories.tsx' }],
			testContext,
		);

		expect(response.result?.content[0].text).toMatchInlineSnapshot(`
			"## Unhandled Errors

			### ReferenceError

			**Error message**: foo is not defined
			**Path**: /src/Button.stories.tsx
			**Test name**: Button > Primary
			**Stack trace**:
			ReferenceError: foo is not defined
			    at Button.tsx:10:5"
		`);
	});

	it('should not report stories as passing when unhandled errors block the run', async () => {
		const testContext = createTestContext();

		// Simulate a case where tests couldn't run at all (e.g., Playwright not installed)
		// componentTestCount.error is 0 because no actual test failures occurred
		// but unhandled errors exist because the test runner couldn't start
		setupChannelResponse({
			status: 'completed',
			result: {
				triggeredBy: 'external:addon-mcp',
				config: { coverage: false, a11y: false },
				storyIds: ['button--primary'],
				totalTestCount: 1,
				startedAt: Date.now(),
				finishedAt: Date.now(),
				coverageSummary: undefined,
				componentTestCount: { success: 0, error: 0 },
				a11yCount: { success: 0, warning: 0, error: 0 },
				componentTestStatuses: [],
				a11yStatuses: [],
				a11yReports: {},
				unhandledErrors: [
					{
						name: 'Error',
						message: "browserType.launch: Executable doesn't exist at /path/to/chromium",
						stack: "Error: browserType.launch: Executable doesn't exist\n    at Browser.ts:100:5",
						VITEST_TEST_PATH: '/src/Button.stories.tsx',
						VITEST_TEST_NAME: 'Button > Primary',
					},
				],
			},
		});

		const response = await callTool(
			[{ exportName: 'Primary', relativePath: 'src/Button.stories.tsx' }],
			testContext,
		);

		// Should NOT contain "Passing Stories" section since tests couldn't run
		expect(response.result).toMatchInlineSnapshot(`
			{
			  "content": [
			    {
			      "text": "## Unhandled Errors

			### Error

			**Error message**: browserType.launch: Executable doesn't exist at /path/to/chromium
			**Path**: /src/Button.stories.tsx
			**Test name**: Button > Primary
			**Stack trace**:
			Error: browserType.launch: Executable doesn't exist
			    at Browser.ts:100:5",
			      "type": "text",
			    },
			  ],
			}
		`);
	});

	it('should show passing stories AND unhandled errors when some tests pass but others have errors', async () => {
		const testContext = createTestContext();

		// Simulate: 3 tests passed, 1 had an unhandled error (e.g., component import failed)
		setupChannelResponse({
			status: 'completed',
			result: {
				triggeredBy: 'external:addon-mcp',
				config: { coverage: false, a11y: false },
				storyIds: ['button--primary', 'button--secondary', 'button--disabled', 'button--loading'],
				totalTestCount: 4,
				startedAt: Date.now(),
				finishedAt: Date.now(),
				coverageSummary: undefined,
				componentTestCount: { success: 3, error: 0 },
				a11yCount: { success: 0, warning: 0, error: 0 },
				componentTestStatuses: [
					{
						storyId: 'button--primary',
						typeId: 'storybook/component-test',
						value: 'status-value:success',
						title: 'Component Test',
						description: '',
					},
					{
						storyId: 'button--secondary',
						typeId: 'storybook/component-test',
						value: 'status-value:success',
						title: 'Component Test',
						description: '',
					},
					{
						storyId: 'button--disabled',
						typeId: 'storybook/component-test',
						value: 'status-value:success',
						title: 'Component Test',
						description: '',
					},
					// button--loading has no status because it had an unhandled error
				],
				a11yStatuses: [],
				a11yReports: {},
				unhandledErrors: [
					{
						name: 'SyntaxError',
						message: 'Cannot find module ./LoadingSpinner',
						stack: 'SyntaxError: Cannot find module ./LoadingSpinner\n    at Button.tsx:5:1',
						VITEST_TEST_PATH: '/src/Button.stories.tsx',
						VITEST_TEST_NAME: 'Button > Loading',
					},
				],
			},
		});

		const response = await callTool(
			[{ exportName: 'Primary', relativePath: 'src/Button.stories.tsx' }],
			testContext,
		);

		// Should show both passing stories AND unhandled errors
		expect(response.result?.content[0].text).toMatchInlineSnapshot(`
			"## Passing Stories

			- button--primary
			- button--secondary
			- button--disabled

			## Unhandled Errors

			### SyntaxError

			**Error message**: Cannot find module ./LoadingSpinner
			**Path**: /src/Button.stories.tsx
			**Test name**: Button > Loading
			**Stack trace**:
			SyntaxError: Cannot find module ./LoadingSpinner
			    at Button.tsx:5:1"
		`);
	});

	it('should return error when no stories found', async () => {
		const testContext = createTestContext();

		const response = await callTool(
			[
				{
					exportName: 'NonExistent',
					relativePath: 'src/NonExistent.stories.tsx',
				},
			],
			testContext,
		);

		// Contains absolute path, so use assertion instead of snapshot
		expect(response.result?.content[0].text).toContain(
			'No stories found matching the provided input',
		);
	});

	it('should handle test run error status', async () => {
		const testContext = createTestContext();

		setupChannelResponse({
			status: 'error',
			error: { message: 'Vitest failed to start' },
		});

		const response = await callTool(
			[{ exportName: 'Primary', relativePath: 'src/Button.stories.tsx' }],
			testContext,
		);

		expect(response.result).toMatchInlineSnapshot(`
			{
			  "content": [
			    {
			      "text": "Error: Vitest failed to start",
			      "type": "text",
			    },
			  ],
			  "isError": true,
			}
		`);
	});

	it('should handle test run cancelled status', async () => {
		const testContext = createTestContext();

		setupChannelResponse({ status: 'cancelled' });

		const response = await callTool(
			[{ exportName: 'Primary', relativePath: 'src/Button.stories.tsx' }],
			testContext,
		);

		expect(response.result).toMatchInlineSnapshot(`
			{
			  "content": [
			    {
			      "text": "Error: Test run was cancelled",
			      "type": "text",
			    },
			  ],
			  "isError": true,
			}
		`);
	});
});
