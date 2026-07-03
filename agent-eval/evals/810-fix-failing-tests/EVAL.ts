import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { expectStoryTestsRanAndPassed } from '#test-utils';

// The fixture ships a Button that never wires the onClick prop to the DOM
// button, so the Default story's play function fails until the agent fixes
// the component. Port of the old 911 eval, hardened with the green-run floor.

// Validation Workflow floor: the run must not end while story tests are
// failing. A single run-story-tests call is enough — agents may spot the
// initial failure through any channel (GPT-5.5 on the plugin path uses the
// project's own test script for that, run 28667804080) as long as the fix
// is verified through the tool.
test('finishes with the story tests passing', () => {
	expectStoryTestsRanAndPassed({ covering: ['button'] });
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
