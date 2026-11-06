import { readForEdit } from '../helpers/edit-parsed-file.ts';
import type { Fix } from '../types.ts';

export const docgenServer: Fix = {
  id: 'docgen-server',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#docgenserver-is-stable-and-enabled-by-default',
  prompt: () => 'Rename features.experimentalDocgenServer to features.docgenServer',

  transform: () => [
    {
      filter: { kind: ['main'], code: 'experimentalDocgenServer' },
      editConfig: (main) => {
        if (!readForEdit(main, ['features', 'experimentalDocgenServer'])) {
          return;
        }
        if (readForEdit(main, ['features', 'docgenServer'])) {
          main.remove(['features', 'experimentalDocgenServer']);
        } else {
          main.rename(['features', 'experimentalDocgenServer'], 'docgenServer');
        }
      },
    },
  ],
};
