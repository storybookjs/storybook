import { expect, test } from 'vitest';
import { transcript } from '@vercel/agent-eval/eval';
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

test('opens the Storybook preview through the preview browser mock', async () => {
	const { agent, integration } = getEvalContext();

	if (agent !== 'claude-code' || integration !== 'plugin') {
		return;
	}

	await expect(transcript).toSatisfyCriterion('Tried to open the Storybook preview in a browser');
});
