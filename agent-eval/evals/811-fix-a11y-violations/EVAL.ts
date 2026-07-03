import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import {
	expectFinalResponseMatches,
	expectStoryTestsRanAndPassed,
	getWorkflowCalls,
	getWorkflowToolResults,
} from '#test-utils';

// The fixture ships a Button with two seeded a11y violations: the icon-only
// story renders a button without an accessible name (button-name, fixable
// directly), and the color scheme fails contrast (color-contrast). The agent
// may fix the contrast itself or surface it as a design decision — both are
// acceptable, it just must not ignore it. Port of the old 912 eval with
// deterministic assertions.

test('runs the story tests more than once while fixing the violations', () => {
	expect(
		getWorkflowCalls('run-story-tests').length,
		'Expected run-story-tests to be called at least twice: once to see the violations, once to verify the fix',
	).toBeGreaterThanOrEqual(2);
});

test('fixes the semantic button-name violation', () => {
	// The full Validation Workflow floor: run-story-tests called, final run
	// succeeded (not errored), reports passing stories, no failing/unhandled
	// sections, and covers the Button stories.
	expectStoryTestsRanAndPassed({ covering: ['button'] });

	// The violation must have been observed before it can count as fixed — a
	// run that never evaluates accessibility cannot claim the fix.
	const results = getWorkflowToolResults('run-story-tests');
	expect(
		results.some((result) => /button-name/.test(result.output)),
		'Expected some run-story-tests result to surface the seeded button-name violation',
	).toBe(true);
	expect(
		results.at(-1)?.output,
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

// Closing the loophole where the button-name absence would be vacuous: a run
// that turns accessibility checks off cannot claim the violations were
// addressed. No passing sample has ever disabled a11y.
test('never disables accessibility checks while fixing a11y issues', () => {
	const disabledCall = getWorkflowCalls('run-story-tests').find(
		(call) => call.input.a11y === false,
	);
	expect(
		disabledCall,
		'Expected no run-story-tests call to pass a11y: false in an a11y-fixing task',
	).toBeUndefined();
});

// The contrast violation must not be ignored: fixing the colors and
// surfacing the issue as a design decision are both fine (requiring
// approval before repainting proved too strict — GPT-5.5 legitimately fixed
// the color in run 28667804080), but the final response has to tell the
// user about it either way.
test('addresses the contrast violation', () => {
	expectFinalResponseMatches([/contrast/i]);
});
