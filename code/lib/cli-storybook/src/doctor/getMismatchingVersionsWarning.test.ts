import { describe, expect, it } from 'vitest';

import type { InstallationMetadata } from 'storybook/internal/common';

import { getMismatchingVersionsWarnings } from './getMismatchingVersionsWarning.ts';

const installation = (dependencies: Record<string, string>): InstallationMetadata => ({
  dependencies: Object.fromEntries(
    Object.entries(dependencies).map(([name, version]) => [name, [{ version, location: '' }]])
  ),
  duplicatedDependencies: {},
  infoCommand: '',
  dedupeCommand: '',
});

describe('getMismatchingVersionsWarnings', () => {
  it('warns when the framework version differs from the storybook version', () => {
    expect(
      getMismatchingVersionsWarnings(
        installation({ '@storybook/react-vite': '10.0.0', storybook: '10.1.0' })
      )
    ).toContain('mismatch');
  });

  it('does not warn when the framework and storybook versions match', () => {
    expect(
      getMismatchingVersionsWarnings(
        installation({ '@storybook/react-vite': '10.1.0', storybook: '10.1.0' })
      )
    ).toBeUndefined();
  });

  it.each([
    ['@analogjs/storybook-angular', '@storybook/angular'],
    ['@storybook-astro/framework', '@storybook/react'],
  ])('ignores the version of the community framework %s', (communityFramework, renderer) => {
    expect(
      getMismatchingVersionsWarnings(
        installation({ [communityFramework]: '2.9.7', [renderer]: '10.1.0', storybook: '10.1.0' })
      )
    ).toBeUndefined();
  });

  it('still warns about a mismatched Storybook framework listed after a community one', () => {
    expect(
      getMismatchingVersionsWarnings(
        installation({
          '@analogjs/storybook-angular': '2.9.7',
          '@storybook/angular': '10.0.0',
          storybook: '10.1.0',
        })
      )
    ).toContain('mismatch');
  });
});
