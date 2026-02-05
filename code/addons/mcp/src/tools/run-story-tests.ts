import type { McpServer } from 'tmcp';
import { logger } from 'storybook/internal/node-logger';
import * as v from 'valibot';
import { fetchStoryIndex } from '../utils/fetch-story-index.ts';
import { findStoryIds } from '../utils/find-story-ids.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import type { AddonContext } from '../types.ts';
import { StoryInputArray } from '../types.ts';
import type { TriggerTestRunResponsePayload } from '@storybook/addon-vitest/constants';
import type Channel from 'storybook/internal/channels';
import type { StoryId } from 'storybook/internal/csf';
import type { A11yReport } from '@storybook/addon-a11y';
import { RUN_STORY_TESTS_TOOL_NAME } from './tool-names.ts';

/**
 * Check if addon-vitest is available by trying to import its constants.
 * Returns the constants if available, undefined otherwise.
 */
export async function getAddonVitestConstants() {
	return await import('@storybook/addon-vitest/constants')
		.then((mod) => ({
			TRIGGER_TEST_RUN_REQUEST: mod.TRIGGER_TEST_RUN_REQUEST,
			TRIGGER_TEST_RUN_RESPONSE: mod.TRIGGER_TEST_RUN_RESPONSE,
		}))
		.catch(() => undefined);
}

const RunStoryTestsInput = v.object({
	stories: StoryInputArray,
});
export async function addRunStoryTestsTool(server: McpServer<any, AddonContext>) {
	const addonVitestConstants = await getAddonVitestConstants();

	server.tool(
		{
			name: RUN_STORY_TESTS_TOOL_NAME,
			title: 'Storybook Tests',
			description: `Run tests for one or more stories.`,
			schema: RunStoryTestsInput,
			enabled: () => {
				if (!addonVitestConstants) {
					return false;
				}
				return server.ctx.custom?.toolsets?.test ?? true;
			},
		},
		async (input: v.InferOutput<typeof RunStoryTestsInput>) => {
			try {
				const { origin, options } = server.ctx.custom ?? {};

				if (!origin) {
					throw new Error('Origin is required in addon context');
				}

				if (!options) {
					throw new Error('Options are required in addon context');
				}

				// Access channel from options (available at runtime even though types don't declare it)
				const channel = (options as unknown as { channel: Channel }).channel;
				if (!channel) {
					throw new Error('Channel is not available');
				}

				const index = await fetchStoryIndex(origin);
				const { found, notFound } = findStoryIds(index, input.stories);

				const storyIds = found.map((story) => story.id);

				if (storyIds.length === 0) {
					const errorMessages = notFound.map((story) => story.errorMessage).join('\n');
					return {
						content: [
							{
								type: 'text',
								text: `No stories found matching the provided input.\n\n${errorMessages}`,
							},
						],
					};
				}

				logger.info(`Running tests for story IDs: ${storyIds.join(', ')}`);

				// Trigger test run via channel events
				const responsePayload = await triggerTestRun(
					channel,
					addonVitestConstants!.TRIGGER_TEST_RUN_REQUEST,
					addonVitestConstants!.TRIGGER_TEST_RUN_RESPONSE,
					storyIds,
				);

				const testResults = responsePayload.result;
				if (!testResults) {
					throw new Error('Test run response missing result data');
				}

				const sections: string[] = [];

				const componentTestStatuses = testResults.componentTestStatuses;

				const passingStories = componentTestStatuses.filter(
					(status) => status.value === 'status-value:success',
				);
				const failingStories = componentTestStatuses.filter(
					(status) => status.value === 'status-value:error',
				);

				if (passingStories.length > 0) {
					sections.push(
						`## Passing Stories\n\n- ${passingStories.map((status) => status.storyId).join('\n- ')}`,
					);
				}

				if (failingStories.length > 0) {
					sections.push(
						`## Failing Stories\n\n${failingStories
							.map((status) => `### ${status.storyId}\n\n${status.description}`)
							.join('\n\n')}`,
					);
				}

				console.log({ testResults });
				const a11yReports = testResults.a11yReports as Record<StoryId, A11yReport[]>;
				if (a11yReports && Object.keys(a11yReports).length > 0) {
					const a11yViolationSections: string[] = [];

					for (const [storyId, reports] of Object.entries(a11yReports)) {
						for (const report of reports) {
							// Check if report is an error
							if ('error' in report && report.error) {
								a11yViolationSections.push(`### ${storyId} - Error\n\n${report.error.message}`);
								continue;
							}

							const violations = (report as any).violations || [];

							if (violations.length > 0) {
								for (const violation of violations) {
									const nodes = violation.nodes
										.map((node: any) => {
											const inspectLink = node.linkPath ? `${origin}${node.linkPath}` : undefined;
											const parts = [] as string[];

											if (node.impact) {
												parts.push(`- **Impact**: ${node.impact}`);
											}

											if (node.failureSummary || node.message) {
												parts.push(`  **Message**: ${node.failureSummary || node.message}`);
											}

											parts.push(`  **Element**: ${node.html || '(no html available)'}`);

											if (inspectLink) {
												parts.push(`  **Inspect**: ${inspectLink}`);
											}

											return parts.join('\n');
										})
										.join('\n');

									a11yViolationSections.push(
										`### ${storyId} - ${violation.id}\n\n${violation.description}\n\n#### Affected Elements\n${nodes}`,
									);
								}
							}
						}
					}

					if (a11yViolationSections.length > 0) {
						sections.push(`## Accessibility Violations\n\n${a11yViolationSections.join('\n\n')}`);
					}
				}

				if (testResults.unhandledErrors.length > 0) {
					sections.push(
						`## Unhandled Errors\n\n${testResults.unhandledErrors
							.map(
								(unhandledError) =>
									`### ${unhandledError.name || 'Unknown Error'}\n\n**Error message**: ${unhandledError.message || 'No message available'}\n**Path**: ${unhandledError.VITEST_TEST_PATH || 'No path available'}\n**Test name**: ${unhandledError.VITEST_TEST_NAME || 'No test name available'}\n**Stack trace**:\n${unhandledError.stack || 'No stack trace available'}`,
							)
							.join('\n\n')}`,
					);
				}

				const textResult = sections.join('\n\n');

				return {
					content: [
						{
							type: 'text',
							text: textResult,
						},
					],
				};
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
}

/**
 * Trigger a test run via Storybook channel events.
 * This is the channel-based API for triggering tests in addon-vitest.
 */
function triggerTestRun(
	channel: Channel,
	triggerTestRunRequestEventName: string,
	triggerTestRunResponseEventName: string,
	storyIds: string[],
): Promise<TriggerTestRunResponsePayload> {
	return new Promise((resolve, reject) => {
		const requestId = `mcp-${Date.now()}`;

		const handleResponse = (payload: TriggerTestRunResponsePayload) => {
			if (payload.requestId !== requestId) {
				return;
			}

			channel.off(triggerTestRunResponseEventName, handleResponse);

			switch (payload.status) {
				case 'completed':
					if (payload.result) {
						resolve(payload);
					} else {
						reject(new Error('Test run completed but no result was returned'));
					}
					break;
				case 'error':
					reject(new Error(payload.error?.message ?? 'Test run failed with unknown error'));
					break;
				case 'cancelled':
					reject(new Error('Test run was cancelled'));
					break;
				default:
					reject(new Error('Unexpected test run response'));
			}
		};

		channel.on(triggerTestRunResponseEventName, handleResponse);

		const request = {
			requestId,
			actor: 'addon-mcp',
			storyIds,
		} as const;

		channel.emit(triggerTestRunRequestEventName, request);
	});
}
