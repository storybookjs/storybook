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

// The plugin requires Storybook >= 10.5 (or `next` while 10.5 is unreleased),
// so an under-upgrade (e.g. landing on 10.0.0 or the 10.4.x stable) must not
// count. Prerelease specs like 10.5.0-beta.0 parse as (10,5,0) and satisfy
// the floor. Bump alongside future requirement changes.
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
