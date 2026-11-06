import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  expectShellCommandMatching,
  expectSkillInvoked,
  expectStorybookBoots,
  expectStorybookDependenciesAtLeast,
  expectStorybookInstalledFromCheckout,
  isRecord,
  parseJson,
} from '#test-utils';

describe('initializing Storybook in a project without it', () => {
  test('invokes the storybook-init skill', () => {
    expectSkillInvoked('storybook-init');
  });

  // Loose match: `npm create storybook@latest`, the package-manager
  // equivalents, and the `storybook init` alias all count.
  test('runs the Storybook initializer', () => {
    expectShellCommandMatching(/create(-|\s+)storybook|storybook(@\S+)?\s+init/);
  });

  test('installs Storybook', () => {
    const packageJson = parseJson(readFileSync('package.json', 'utf8'));
    if (!isRecord(packageJson)) {
      expect.fail('Expected package.json to contain a JSON object');
    }

    const dependencies = {
      ...(isRecord(packageJson.dependencies) ? packageJson.dependencies : {}),
      ...(isRecord(packageJson.devDependencies) ? packageJson.devDependencies : {}),
    };
    expect(dependencies.storybook, 'Expected a storybook dependency').toBeTypeOf('string');

    const scripts = isRecord(packageJson.scripts) ? packageJson.scripts : {};
    expect(scripts.storybook, 'Expected a storybook script').toBeTypeOf('string');
  });

  // The plugin requires Storybook >= 11.0, so initializing the 10.x stable release must not
  // count. Prerelease specs like 11.0.0-alpha.2 parse as (11,0,0) and satisfy the floor.
  test('installs the plugin-required release', () => {
    expectStorybookDependenciesAtLeast('11.0.0', ['storybook', '@storybook/react-vite']);
  });

  test('installs the Storybook build of this checkout', () => {
    expectStorybookInstalledFromCheckout();
  });

  test('the initialized Storybook boots', async () => {
    await expectStorybookBoots();
  });
});
