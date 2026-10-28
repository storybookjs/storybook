import { isAtOrPastVersion } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';

export const removeLegacyFeatureFlags: Fix = {
  id: 'remove-legacy-feature-flags',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#argtypetargetsv7-feature-flag-removed',
  prompt: () =>
    'Remove features.argTypeTargetsV7 and features.disallowImplicitActionsInRenderV8. Both flags are always on in Storybook 11.',

  check: async ({ storybookVersion, mainConfig }) => {
    if (!isAtOrPastVersion(storybookVersion, '11.0.0')) {
      return null;
    }
    const features = mainConfig.features ?? {};
    const hasRemovedFlag =
      'argTypeTargetsV7' in features || 'disallowImplicitActionsInRenderV8' in features;
    return hasRemovedFlag ? {} : null;
  },

  transform: () => [
    {
      filter: { kind: ['main'], code: /argTypeTargetsV7|disallowImplicitActionsInRenderV8/ },
      // `remove` fails on a spread in `features`, even when the flag is only mentioned in a comment.
      editConfig: (main) => {
        if (main.getFieldNode(['features', 'argTypeTargetsV7'])) {
          main.remove(['features', 'argTypeTargetsV7']);
        }
        if (main.getFieldNode(['features', 'disallowImplicitActionsInRenderV8'])) {
          main.remove(['features', 'disallowImplicitActionsInRenderV8']);
        }
      },
    },
  ],
};
