import { test } from 'vitest';
import {
	expectShellCommandMatching,
	expectSkillInvoked,
	expectStorybookBoots,
	expectStorybookDependenciesAtLeast,
} from '#test-utils';

// Regression fixture for a setup request against an already-installed but
// outdated Storybook (seeded 10.4.0, evals.pinStorybook: false): the agent
// must notice the version is below the plugin requirement and route through
// the upgrade skill instead of setting up on the old version. Same prompt as
// 820-init-no-storybook — only the seeded state differs. Which entry skill
// handles the request (setup vs stories) is deliberately not asserted; the
// upgrade routing is the behavior under test.

test('routes to the storybook-upgrade skill', () => {
	expectSkillInvoked('storybook-upgrade');
});

test('runs the Storybook upgrade command', () => {
	expectShellCommandMatching(/storybook(@\S+)?\s+upgrade/);
});

// The plugin requires Storybook >= 10.5 (or `next` while 10.5 is unreleased),
// so the seeded 10.4.0 must land at or above that — settling on the 10.4.x
// stable is exactly the bug this guards against. Prerelease specs like
// 10.5.0-beta.0 parse as (10,5,0) and satisfy the floor. Bump alongside
// future requirement changes.
test('upgrades the Storybook packages to the plugin-required release', () => {
	expectStorybookDependenciesAtLeast('10.5.0', ['storybook', '@storybook/react-vite'], {
		// Storybook 10 absorbs @storybook/react — a correct upgrade removes it,
		// but a stale seeded copy left behind must fail the floor.
		ifPresent: ['@storybook/react'],
	});
});

test('the upgraded Storybook boots', async () => {
	await expectStorybookBoots();
});
