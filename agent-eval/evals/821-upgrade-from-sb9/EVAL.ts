import { test } from 'vitest';
import {
	expectShellCommandMatching,
	expectSkillInvoked,
	expectStorybookBoots,
	expectStorybookDependenciesAtLeast,
} from '#test-utils';

// Only the lifecycle outcome is asserted; the story/review workflow is owned
// by the 80x evals. The fixture opts out of the harness version pinning
// (evals.pinStorybook: false) to keep the seeded 9.1.20.

test('invokes the storybook-upgrade skill', () => {
	expectSkillInvoked('storybook-upgrade');
});

test('runs the Storybook upgrade command', () => {
	expectShellCommandMatching(/storybook(@\S+)?\s+upgrade/);
});

// 10.4.6 is the stable release at fixture-authoring time; an under-upgrade
// (e.g. landing on 10.0.0) must not count. Bump alongside future stables.
test('upgrades the Storybook packages to the current release', () => {
	expectStorybookDependenciesAtLeast('10.4.6', ['storybook', '@storybook/react-vite'], {
		// Storybook 10 absorbs @storybook/react — a correct upgrade removes it,
		// but a stale seeded copy left behind must fail the floor.
		ifPresent: ['@storybook/react'],
	});
});

test('the upgraded Storybook boots', async () => {
	await expectStorybookBoots();
});
