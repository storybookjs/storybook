import { describe, expect, it } from 'vitest';

import { isGlobalInput, isTestFixture } from './global-inputs.ts';

describe('isGlobalInput', () => {
  it.each([
    'yarn.lock',
    '.yarnrc.yml',
    'nx.json',
    '.nvmrc',
    'tsconfig.json',
    'code/core/package.json',
    'code/core/tsconfig.build.json',
    'code/vitest.shared.ts',
    'code/vitest-setup.ts',
    'code/vitest.config.storybook.ts',
    'code/lib/eslint-plugin/vitest.integration.config.ts',
    'code/addons/a11y/vitest.config.ts',
    'code/builders/builder-vite/vite.config.ts',
    'code/__mocks__/fs.ts',
    '.yarn/patches/@vitest-expect-npm-3.2.4-97c526d5cc.patch',
  ])('treats %s as a global input', (file) => {
    expect(isGlobalInput(file)).toBe(true);
  });

  it.each([
    'code/core/src/manager/App.tsx',
    'code/core/src/manager/App.test.tsx',
    'code/addons/a11y/README.md',
    'docs/get-started/introduction.mdx',
    'code/builders/builder-vite/src/vite-config.ts',
    'code/core/src/cli/vitest-config.ts',
    'code/lib/cli-storybook/src/automigrate/fixes/vitest-setup-file.ts',
  ])('does not treat %s as a global input', (file) => {
    expect(isGlobalInput(file)).toBe(false);
  });
});

describe('isTestFixture', () => {
  it.each([
    'code/addons/a11y/src/__snapshots__/a11yRunner.test.ts.snap',
    'code/addons/a11y/src/__fixtures__/axe-result.ts',
    'code/lib/cli-storybook/src/fixtures/main.js',
  ])('treats %s as a test fixture', (file) => {
    expect(isTestFixture(file)).toBe(true);
  });

  it.each(['code/addons/a11y/src/a11yRunner.ts', 'code/addons/a11y/README.md'])(
    'does not treat %s as a test fixture',
    (file) => {
      expect(isTestFixture(file)).toBe(false);
    }
  );
});
