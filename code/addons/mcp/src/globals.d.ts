declare module '*.md' {
	const content: string;
	export default content;
}
declare module '*.html' {
	const content: string;
	export default content;
}

declare module '@storybook/addon-vitest/constants' {
	export const TRIGGER_TEST_RUN_REQUEST: string;
	export const TRIGGER_TEST_RUN_RESPONSE: string;

	export interface TriggerTestRunRequestPayload {
		requestId: string;
		actor: string;
		storyIds?: string[];
	}

	export interface TriggerTestRunResponsePayload {
		requestId: string;
		status: 'completed' | 'error' | 'cancelled';
		result?: {
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
			coverageSummary?: unknown;
		};
		error?: {
			message: string;
			error?: unknown;
		};
	}
}
