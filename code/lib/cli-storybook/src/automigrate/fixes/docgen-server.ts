import type { Fix } from '../types.ts';

export const docgenServer: Fix = {
  id: 'docgen-server',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#docgenserver-is-stable-and-enabled-by-default',
  prompt: () => 'Rename features.experimentalDocgenServer to features.docgenServer',

  transform: () => [
    {
      filter: { kind: ['main'], code: 'experimentalDocgenServer' },
      editConfig: (main) => {
        if (!main.get(['features', 'experimentalDocgenServer'])) {
          return;
        }
        if (main.get(['features', 'docgenServer'])) {
          main.remove(['features', 'experimentalDocgenServer']);
        } else {
          main.rename(['features', 'experimentalDocgenServer'], 'docgenServer');
        }
      },
    },
  ],
};
