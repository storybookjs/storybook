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
		options?: { a11y?: boolean },
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
					...(options?.a11y !== undefined && { a11y: options.a11y }),
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

		await addRunStoryTestsTool(server, { a11yEnabled: true });

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
				config: { coverage: false, a11y: true },
			}),
		);
	});

	it('should pass a11y: false in config when disabled via input', async () => {
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
				a11yCount: { success: 0, warning: 0, error: 0 },
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
			{ a11y: false },
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
				config: { coverage: false, a11y: false },
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

			Expected button text to be "Secondary""
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

	describe('queue behavior', () => {
		it('should process concurrent calls in order', async () => {
			const testContext = createTestContext();
			const executionOrder: string[] = [];
			const completionOrder: string[] = [];

			// Set up channel to track execution order and respond immediately
			// Must call ALL registered handlers since concurrent calls register multiple handlers
			mockChannel.emit.mockImplementation((event, payload: any) => {
				if (event === 'storybook/test/trigger-test-run-request') {
					const storyId = payload.storyIds[0];
					executionOrder.push(storyId);

					// Call all registered response handlers (they filter by requestId internally)
					const responseHandlers = mockChannel.on.mock.calls
						.filter((call) => call[0] === 'storybook/test/trigger-test-run-response')
						.map((call) => call[1]);

					const response = {
						requestId: payload.requestId,
						status: 'completed',
						result: {
							triggeredBy: 'external:addon-mcp',
							config: { coverage: false, a11y: false },
							storyIds: [storyId],
							totalTestCount: 1,
							startedAt: Date.now(),
							finishedAt: Date.now(),
							coverageSummary: undefined,
							componentTestCount: { success: 1, error: 0 },
							a11yCount: { success: 0, warning: 0, error: 0 },
							componentTestStatuses: [
								{
									storyId,
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
					};

					responseHandlers.forEach((handler) => handler(response));
				}
			});

			// Fire 4 calls concurrently - they should execute in FIFO order due to queue
			const call1 = callTool(
				[{ exportName: 'Primary', relativePath: 'src/Button.stories.tsx' }],
				testContext,
			).then((r) => {
				completionOrder.push('button--primary');
				return r;
			});
			const call2 = callTool(
				[{ exportName: 'Secondary', relativePath: 'src/Button.stories.tsx' }],
				testContext,
			).then((r) => {
				completionOrder.push('button--secondary');
				return r;
			});
			const call3 = callTool(
				[{ exportName: 'Default', relativePath: 'src/Input.stories.tsx' }],
				testContext,
			).then((r) => {
				completionOrder.push('input--default');
				return r;
			});
			const call4 = callTool(
				[{ exportName: 'Primary', relativePath: 'src/Button.stories.tsx' }],
				testContext,
			).then((r) => {
				completionOrder.push('button--primary-2');
				return r;
			});

			// Wait for all calls to complete
			const results = await Promise.all([call1, call2, call3, call4]);

			// All calls should succeed
			expect(results.every((r) => r.result?.content[0]?.text?.includes('Passing Stories'))).toBe(
				true,
			);

			// Execution order should match call order (FIFO)
			expect(executionOrder).toEqual([
				'button--primary',
				'button--secondary',
				'input--default',
				'button--primary',
			]);

			// Completion order should also match call order
			expect(completionOrder).toEqual([
				'button--primary',
				'button--secondary',
				'input--default',
				'button--primary-2',
			]);
		});

		it('should timeout waiting for previous operation and allow next operation to proceed', async () => {
			vi.useFakeTimers();

			try {
				const testContext = createTestContext();
				let firstCallStarted = false;
				let secondCallCompleted = false;

				// Set up channel: first call never responds, second call responds immediately
				mockChannel.emit.mockImplementation((event, payload: any) => {
					if (event === 'storybook/test/trigger-test-run-request') {
						if (!firstCallStarted) {
							// First call - record it started but never respond (simulate hung operation)
							firstCallStarted = true;
							// Don't call any handlers - simulating the test run hanging
						} else {
							// Second call - respond to all handlers
							const responseHandlers = mockChannel.on.mock.calls
								.filter((call) => call[0] === 'storybook/test/trigger-test-run-response')
								.map((call) => call[1]);

							const storyId = payload.storyIds[0];
							const response = {
								requestId: payload.requestId,
								status: 'completed',
								result: {
									triggeredBy: 'external:addon-mcp',
									config: { coverage: false, a11y: false },
									storyIds: [storyId],
									totalTestCount: 1,
									startedAt: Date.now(),
									finishedAt: Date.now(),
									coverageSummary: undefined,
									componentTestCount: { success: 1, error: 0 },
									a11yCount: { success: 0, warning: 0, error: 0 },
									componentTestStatuses: [
										{
											storyId,
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
							};

							responseHandlers.forEach((handler) => handler(response));
						}
					}
				});

				// Start first call (will hang forever because channel never responds)
				let firstCallCompleted = false;
				void callTool(
					[{ exportName: 'Primary', relativePath: 'src/Button.stories.tsx' }],
					testContext,
				).then(() => {
					firstCallCompleted = true;
				});

				// Let first call start executing (get past queue.wait() to the channel emit)
				await vi.advanceTimersByTimeAsync(0);

				// Verify first call started (emitted to channel)
				expect(firstCallStarted).toBe(true);

				// Start second call (will wait for first call's done() which never comes)
				const secondCall = callTool(
					[{ exportName: 'Secondary', relativePath: 'src/Button.stories.tsx' }],
					testContext,
				).then((r) => {
					secondCallCompleted = true;
					return r;
				});

				// Let second call start waiting in queue
				await vi.advanceTimersByTimeAsync(0);

				// Second call should not have completed yet (waiting for first)
				expect(secondCallCompleted).toBe(false);
				// First call should also not have completed (waiting for channel response)
				expect(firstCallCompleted).toBe(false);

				// Advance time past the 15-second timeout
				await vi.advanceTimersByTimeAsync(15_000);

				// Now second call should have timed out waiting and failed
				const secondResult = await secondCall;

				expect(secondCallCompleted).toBe(true);

				// The timeout error is thrown outside the try/catch in the tool handler,
				// so tmcp converts it to a JSONRPC error response
				expect(secondResult.error).toBeDefined();
				expect(secondResult.error?.message).toContain('Timed out waiting for previous operation');

				// First call should still be pending (channel never responded)
				expect(firstCallCompleted).toBe(false);
				// Only first call emitted to channel (second call timed out before reaching emit)
				expect(mockChannel.emit).toHaveBeenCalledTimes(1);
			} finally {
				vi.useRealTimers();
			}
		});
	});
});
