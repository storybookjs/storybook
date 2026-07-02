import { test } from 'vitest';
import {
	expectShellCommandMatching,
	expectSkillInvoked,
	expectStorybookBoots,
	expectStorybookDependencyAbove,
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

test('moves the storybook dependency past the seeded 10.4.0', () => {
	expectStorybookDependencyAbove('10.4.0');
});

test('the upgraded Storybook boots', async () => {
	await expectStorybookBoots();
});
