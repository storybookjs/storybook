import { expect, test } from 'vitest';
import { getStorybookWorkflowCalls, type StorybookWorkflowCall } from '#test-utils';

function expectWorkflowCalls(expectedNames: string[]): void {
	for (const name of expectedNames) {
		expect(workflowCalls(name).length).toBeGreaterThan(0);
	}
}

function workflowCalls(name: string): StorybookWorkflowCall[] {
	return getStorybookWorkflowCalls().filter((call) => call.name === name);
}

function usesPathAndExport(call: StorybookWorkflowCall): boolean {
	if (
		typeof call.input.absoluteStoryPath === 'string' &&
		typeof call.input.exportName === 'string'
	) {
		return true;
	}

	const stories = call.input.stories;
	return (
		Array.isArray(stories) &&
		stories.some((story) => {
			return (
				isRecord(story) &&
				typeof story.absoluteStoryPath === 'string' &&
				typeof story.exportName === 'string'
			);
		})
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

test('previews stories using path and export inputs', () => {
	expectWorkflowCalls(['preview-stories']);
	expect(workflowCalls('preview-stories').some(usesPathAndExport)).toBe(true);
});
