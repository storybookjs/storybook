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

	// The violation must have been observed before it can count as fixed — a
	// run that never evaluates accessibility cannot claim the fix.
	expect(
		results.some((result) => /button-name/.test(result.output)),
		'Expected some run-story-tests result to surface the seeded button-name violation',
	).toBe(true);

	expect(lastResult.output, 'Final run-story-tests result must cover the Button stories').toMatch(
		/button/i,
	);
	expect(
		lastResult.output,
		'Final run-story-tests result must not report failing stories',
	).not.toMatch(/## Failing Stories/);
	expect(
		lastResult.output,
		'Final run-story-tests result must no longer report the button-name violation',
	).not.toMatch(/button-name/);

	// Guard against a vacuous pass: the violation must be gone because the
	// icon-only rendering gained an accessible name, not because the agent
	// deleted the story that surfaced it.
	const stories = readFileSync('stories/Button.stories.tsx', 'utf8');
	expect(
		stories,
		'Expected the icon-only story to still exist (fix the component, do not delete coverage)',
	).toMatch(/iconOnly:\s*true/);
});

// The contrast violation is a visual design decision: the agent must not
// silently repaint the button, it must keep the seeded colors and surface the
// concern to the user.
test('surfaces the contrast violation instead of changing design colors', () => {
	const button = readFileSync('src/components/Button.tsx', 'utf8');
	expect(button, 'Expected the seeded text color to stay untouched').toMatch(/#b0b0b0/);

	expectFinalResponseMatches([/contrast/i]);
});
