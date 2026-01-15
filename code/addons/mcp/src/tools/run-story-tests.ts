import type { McpServer } from 'tmcp';
import { logger } from 'storybook/internal/node-logger';
import * as v from 'valibot';
import { fetchStoryIndex } from '../utils/fetch-story-index.ts';
import { findStoryIds } from '../utils/find-story-ids.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import type { AddonContext } from '../types.ts';
import { StoryInputArray } from '../types.ts';

export const RUN_STORY_TESTS_TOOL_NAME = 'run-story-tests';

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

type RunStoryTestsInput = v.InferOutput<typeof RunStoryTestsInput>;

export async function addRunStoryTestsTool(
	server: McpServer<any, AddonContext>,
) {
	const addonVitestConstants = await getAddonVitestConstants();

	server.tool(
		{
			name: RUN_STORY_TESTS_TOOL_NAME,
			title: 'Run Storybook Tests',
			description: `Run tests for one or more stories.`,
			schema: RunStoryTestsInput,
			enabled: () => {
				if (!addonVitestConstants) {
					return false;
				}
				return server.ctx.custom?.toolsets?.test ?? true;
			},
		},
		async (input: RunStoryTestsInput) => {
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
					const errorMessages = notFound
						.map((story) => story.errorMessage)
						.join('\n');
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
				const testResults = await triggerTestRunViaChannel(
					channel,
					addonVitestConstants!,
					storyIds,
				);

				logger.debug('Test results:');
				logger.debug(JSON.stringify(testResults, null, 2));

				let textResult = '';

				if (testResults.componentTestCount.error === 0) {
					textResult += `## Passing Stories\n\n- ${storyIds.join('\n- ')}`;
				} else {
					const componentTestStatuses = testResults.componentTestStatuses;

					const passingStories = componentTestStatuses.filter(
						(status) => status.value === 'status-value:success',
					);
					const failingStories = componentTestStatuses.filter(
						(status) => status.value === 'status-value:error',
					);

					if (passingStories.length > 0) {
						textResult += `## Passing Stories

- ${passingStories.map((status) => status.storyId).join('\n- ')}

`;
					}

					if (failingStories.length > 0) {
						textResult += `## Failing Stories

${failingStories
	.map(
		(status) => `### ${status.storyId}

${status.description}`,
	)
	.join('\n\n')}

`;
					}
				}

				// Add a11y violations section
				const a11yViolations = testResults.a11yStatuses.filter(
					(status) =>
						status.value === 'status-value:error' ||
						status.value === 'status-value:warning',
				);

				if (a11yViolations.length > 0) {
					const a11yErrors = a11yViolations.filter(
						(status) => status.value === 'status-value:error',
					);
					const a11yWarnings = a11yViolations.filter(
						(status) => status.value === 'status-value:warning',
					);

					textResult += `## Accessibility Violations

`;

					if (a11yErrors.length > 0) {
						textResult += `### Errors

${a11yErrors
	.map(
		(status) => `#### ${status.storyId}

${status.description}`,
	)
	.join('\n\n')}

`;
					}

					if (a11yWarnings.length > 0) {
						textResult += `### Warnings

${a11yWarnings
	.map(
		(status) => `#### ${status.storyId}

${status.description}`,
	)
	.join('\n\n')}

`;
					}
				}

				if (testResults.unhandledErrors.length > 0) {
					textResult += `## Unhandled Errors

${testResults.unhandledErrors
	.map(
		(unhandledError) =>
			`### ${unhandledError.name || 'Unknown Error'}

**Error message**: ${unhandledError.message || 'No message available'}
**Path**: ${unhandledError.VITEST_TEST_PATH || 'No path available'}
**Test name**: ${unhandledError.VITEST_TEST_NAME || 'No test name available'}
**Stack trace**:
${unhandledError.stack || 'No stack trace available'}`,
	)
	.join('\n\n')}`;
				}

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

interface Channel {
	on(event: string, callback: (payload: unknown) => void): void;
	off(event: string, callback: (payload: unknown) => void): void;
	emit(event: string, payload: unknown): void;
}

interface AddonVitestConstants {
	TRIGGER_TEST_RUN_REQUEST: string;
	TRIGGER_TEST_RUN_RESPONSE: string;
}

interface TestRunResult {
	storyIds?: string[];
	componentTestCount: {
		success: number;
		error: number;
	};
	a11yCount: {
		success: number;
		warning: number;
		error: number;
	};
	componentTestStatuses: Array<{
		storyId: string;
		typeId: string;
		value: string;
		description: string;
	}>;
	a11yStatuses: Array<{
		storyId: string;
		typeId: string;
		value: string;
		description: string;
	}>;
	unhandledErrors: Array<{
		name?: string;
		message?: string;
		stack?: string;
		VITEST_TEST_PATH?: string;
		VITEST_TEST_NAME?: string;
	}>;
}

/**
 * Trigger a test run via Storybook channel events.
 * This is the channel-based API for triggering tests in addon-vitest.
 */
function triggerTestRunViaChannel(
	channel: Channel,
	constants: AddonVitestConstants,
	storyIds: string[],
): Promise<TestRunResult> {
	return new Promise((resolve, reject) => {
		const requestId = `mcp-${Date.now()}`;

		const handleResponse = (payloadUnknown: unknown) => {
			const payload =
				payloadUnknown as import('@storybook/addon-vitest/constants').TriggerTestRunResponsePayload;

			if (payload.requestId !== requestId) {
				return;
			}

			channel.off(constants.TRIGGER_TEST_RUN_RESPONSE, handleResponse);

			switch (payload.status) {
				case 'completed':
					if (payload.result) {
						resolve({
							storyIds: payload.result.storyIds,
							componentTestCount: payload.result.componentTestCount,
							a11yCount: payload.result.a11yCount,
							componentTestStatuses: payload.result.componentTestStatuses,
							a11yStatuses: payload.result.a11yStatuses,
							unhandledErrors: payload.result.unhandledErrors,
						});
					} else {
						reject(new Error('Test run completed but no result was returned'));
					}
					break;
				case 'error':
					reject(
						new Error(
							payload.error?.message ?? 'Test run failed with unknown error',
						),
					);
					break;
				case 'cancelled':
					reject(new Error('Test run was cancelled'));
					break;
				default:
					reject(new Error('Unexpected test run response'));
			}
		};

		channel.on(constants.TRIGGER_TEST_RUN_RESPONSE, handleResponse);

		const request: import('@storybook/addon-vitest/constants').TriggerTestRunRequestPayload =
			{
				requestId,
				actor: 'addon-mcp',
				storyIds,
			};

		channel.emit(constants.TRIGGER_TEST_RUN_REQUEST, request);
	});
}
