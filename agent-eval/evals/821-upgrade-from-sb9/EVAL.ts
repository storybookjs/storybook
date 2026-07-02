import { test } from 'vitest';
import {
	expectShellCommandMatching,
	expectSkillInvoked,
	expectStorybookBoots,
	expectStorybookDependenciesAtLeast,
} from '#test-utils';

// Lifecycle eval (storybookjs/mcp#324): Storybook 9.x is preinstalled (the
// qa/sb9-no-mcp scenario), so the storybook-upgrade skill must drive the major
// upgrade. Pass criteria are the lifecycle outcome only — the story/review
// workflow is owned by the 80x evals. The fixture opts out of the harness
// version pinning (evals.pinStorybook: false) to keep the seeded 9.1.20.

test('invokes the storybook-upgrade skill', () => {
	expectSkillInvoked('storybook-upgrade');
});

// The documented upgrade path runs the storybook upgrade CLI.
test('runs the Storybook upgrade command', () => {
	expectShellCommandMatching(/storybook(@\S+)?\s+upgrade/);
});

// 10.4.6 is the stable release at fixture-authoring time; an under-upgrade
// (e.g. landing on 10.0.0) must not count. Bump alongside future stables.
test('upgrades the Storybook packages to the current release', () => {
	expectStorybookDependenciesAtLeast('10.4.6', ['storybook', '@storybook/react-vite']);
});

test('the upgraded Storybook boots', async () => {
	await expectStorybookBoots();
});
