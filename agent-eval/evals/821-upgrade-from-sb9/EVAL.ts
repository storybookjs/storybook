import { describe, test } from 'vitest';
import {
  expectShellCommandMatching,
  expectSkillInvoked,
  expectStorybookBoots,
  expectStorybookDependenciesAtLeast,
  expectStorybookInstalledFromCheckout,
} from '#test-utils';

describe('upgrading Storybook from version 9', () => {
  // Only the lifecycle outcome is asserted; the story/review workflow is owned
  // by the 80x evals. The fixture lists exact versions, not
  // `workspace:*`, so the harness keeps the seeded 9.1.20.

  test('invokes the storybook-upgrade skill', () => {
    expectSkillInvoked('storybook-upgrade');
  });

  test('runs the Storybook upgrade command', () => {
    expectShellCommandMatching(/storybook(@\S+)?\s+upgrade/);
  });

  // The plugin requires Storybook >= 11.0 (or `next` while 11.0 is unreleased),
  // so an under-upgrade (e.g. landing on 10.0.0 or the 10.4.x stable) must not
  // count. Prerelease specs like 11.0.0-alpha.2 parse as (11,0,0) and satisfy
  // the floor. Bump alongside future requirement changes.
  test('upgrades the Storybook packages to the plugin-required release', () => {
    expectStorybookDependenciesAtLeast('11.0.0', ['storybook', '@storybook/react-vite'], {
      // Storybook 10 absorbs @storybook/react — a correct upgrade removes it,
      // but a stale seeded copy left behind must fail the floor.
      ifPresent: ['@storybook/react'],
    });
  });

  test('installs the Storybook build of this checkout', () => {
    expectStorybookInstalledFromCheckout();
  });

  test('the upgraded Storybook boots', async () => {
    await expectStorybookBoots();
  });
});
