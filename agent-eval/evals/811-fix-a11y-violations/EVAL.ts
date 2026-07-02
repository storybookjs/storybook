import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { expectFinalResponseMatches, getWorkflowCalls, getWorkflowToolResults } from '#test-utils';

// The fixture ships a Button with two seeded a11y violations: the icon-only
// story renders a button without an accessible name (button-name, fixable
// directly), and the color scheme fails contrast (color-contrast, a visual
// design change the agent must surface to the user instead of changing colors
// on its own — per the a11y guidance the old 912 judge criterion encoded).
// Port of the old 912 eval with deterministic assertions.

test('runs the story tests more than once while fixing the violations', () => {
	expect(
		getWorkflowCalls('run-story-tests').length,
		'Expected run-story-tests to be called at least twice: once to see the violations, once to verify the fix',
	).toBeGreaterThanOrEqual(2);
});

test('fixes the semantic button-name violation', () => {
	const results = getWorkflowToolResults('run-story-tests');
	const lastResult = results.at(-1);
	if (lastResult === undefined) {
		expect.fail('Expected at least one run-story-tests result in the transcript');
	}

	expect(
		lastResult.output,
		'Final run-story-tests result must not report failing stories',
	).not.toMatch(/## Failing Stories/);
	expect(
		lastResult.output,
		'Final run-story-tests result must no longer report the button-name violation',
	).not.toMatch(/button-name/);
});

// The contrast violation is a visual design decision: the agent must not
// silently repaint the button, it must keep the seeded colors and surface the
// concern to the user.
test('surfaces the contrast violation instead of changing design colors', () => {
	const button = readFileSync('src/components/Button.tsx', 'utf8');
	expect(button, 'Expected the seeded text color to stay untouched').toMatch(/#b0b0b0/);

	expectFinalResponseMatches([/contrast/i]);
});
