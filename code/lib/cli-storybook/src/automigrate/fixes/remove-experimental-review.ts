import { isAtOrPastVersion } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';

export const removeExperimentalReview: Fix = {
  id: 'remove-experimental-review',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#experimentalreview-feature-flag-removed',
  prompt: () =>
    'Remove features.experimentalReview. Review is always available in Storybook 11; changeDetection: false turns it off.',

  // Storybook 10 still reads the flag, so removing it there changes which clients get review.
  check: async ({ storybookVersion }) =>
    isAtOrPastVersion(storybookVersion, '11.0.0') ? {} : null,

  transform: () => [
    {
      filter: { kind: ['main'], code: 'experimentalReview' },
      editConfig: (main) => main.remove(['features', 'experimentalReview']),
    },
  ],
};
