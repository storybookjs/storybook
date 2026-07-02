import { test } from 'vitest';
import {
	expectShellCommandMatching,
	expectSkillInvoked,
	expectStorybookBoots,
	expectStorybookDependenciesAtLeast,
} from '#test-utils';

// Lifecycle eval (storybookjs/mcp#324): an older stable Storybook (10.4.0) is
// preinstalled, so the storybook-upgrade skill drives the minor/patch upgrade
// path — the "user is on stable, needs the current release" scenario. Pass
// criteria are the lifecycle outcome only — the story/review workflow is
// owned by the 80x evals. The fixture opts out of the harness version pinning
// (evals.pinStorybook: false) to keep the seeded 10.4.0.

test('invokes the storybook-upgrade skill', () => {
	expectSkillInvoked('storybook-upgrade');
});

// The documented upgrade path runs the storybook upgrade CLI.
test('runs the Storybook upgrade command', () => {
	expectShellCommandMatching(/storybook(@\S+)?\s+upgrade/);
});

// 10.4.6 is the stable release at fixture-authoring time; the seeded 10.4.0
// must move all the way to the current release, not just past 10.4.0. Bump
// alongside future stables.
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
