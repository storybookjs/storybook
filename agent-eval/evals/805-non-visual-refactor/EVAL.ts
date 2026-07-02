import { test } from 'vitest';
import { expectNoDisplayReview } from '#test-utils';

// Trigger correctness, negative branch (Agentic Review Eval instructions
// §6a.1 / §7 branch 3): a pure rename with no behavior change must not
// publish a review.

test('does not publish a display review for a non-visual refactor', () => {
	expectNoDisplayReview();
});
