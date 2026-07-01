import { expect, test } from 'vitest';
import { getEvalContext, getShellCommands, getToolCalls } from '#test-utils';

test('uses the configured Storybook workflow', () => {
	const { integration } = getEvalContext();

	if (integration === 'plugin') {
		expect(getShellCommands()).toEqual(
			expect.arrayContaining([expect.stringContaining('storybook ai')]),
		);
	} else {
		expect(getToolCalls()).toEqual(
			expect.arrayContaining([
				expect.stringContaining('get-storybook-story-instructions'),
				expect.stringMatching(/preview-stories|display-review/),
			]),
		);
	}
});
