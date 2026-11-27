import { isAtOrPastVersion } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';

export const removeChangeDetectionFlag: Fix = {
  id: 'remove-change-detection-flag',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#changedetection-feature-flag-removed',
  prompt: () => 'Remove features.changeDetection. Change detection is always on in Storybook 11.',

  // Storybook 10 still reads the flag, so removing it there turns change detection back on.
  check: async ({ storybookVersion }) =>
    isAtOrPastVersion(storybookVersion, '11.0.0') ? {} : null,

  transform: () => [
    {
      filter: { kind: ['main'], code: 'changeDetection' },
      // `remove` fails on a spread in `features`, even when the flag is only mentioned in a comment.
      editConfig: (main) => {
        if (main.getFieldNode(['features', 'changeDetection'])) {
          main.remove(['features', 'changeDetection']);
        }
      },
    },
  ],
};
