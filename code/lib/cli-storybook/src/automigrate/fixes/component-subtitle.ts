import type { CsfObject } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import type { Fix } from '../types.ts';

const legacyPath = ['parameters', 'componentSubtitle'];
const subtitlePath = ['parameters', 'docs', 'subtitle'];

const migrate = (object: CsfObject) => {
  if (!object.get(legacyPath)) {
    return;
  }
  if (object.get(subtitlePath)) {
    object.remove(legacyPath);
  } else {
    object.move(legacyPath, subtitlePath);
  }
};

export const componentSubtitle: Fix = {
  id: 'component-subtitle',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#parameterscomponentsubtitle-removed',

  prompt() {
    return `Move deprecated ${picocolors.cyan('parameters.componentSubtitle')} values to ${picocolors.cyan('parameters.docs.subtitle')}`;
  },

  transform: () => [
    {
      filter: { kind: ['preview', 'story'], code: 'componentSubtitle' },
      editConfig: migrate,
      editCsf: (csf) => csf.objects().forEach(migrate),
    },
  ],
};
