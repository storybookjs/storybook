import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { expectStoryTestsRanAndPassed, getWorkflowCalls } from '#test-utils';

// The fixture ships a Button that never wires the onClick prop to the DOM
// button, so the Default story's play function fails until the agent fixes
// the component. Port of the old 911 eval, hardened with the green-run floor.

test('runs the story tests more than once while fixing the failure', () => {
	expect(
		getWorkflowCalls('run-story-tests').length,
		'Expected run-story-tests to be called at least twice: once to see the failure, once to verify the fix',
	).toBeGreaterThanOrEqual(2);
});

// Validation Workflow floor: the run must not end while story tests are
// failing.
test('finishes with the story tests passing', () => {
	expectStoryTestsRanAndPassed();
});

// Guard against a vacuous pass: the tests only turn green through the real
// fix — wiring onClick through to the button element (not by weakening the
// stories).
test('fixes the component instead of the stories', () => {
	const button = readFileSync('src/components/Button.tsx', 'utf8');
	expect(button, 'Expected the Button to wire the onClick prop').toMatch(/onClick=\{/);

	const stories = readFileSync('stories/Button.stories.tsx', 'utf8');
	expect(stories, 'Expected the Default story to keep asserting the onClick behavior').toMatch(
		/toHaveBeenCalled/,
	);
});
