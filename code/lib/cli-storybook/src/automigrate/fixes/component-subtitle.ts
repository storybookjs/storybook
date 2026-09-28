import { formatFileContent } from 'storybook/internal/common';
import {
  type CsfObject,
  formatConfig,
  loadConfig,
  loadCsf,
  printCsf,
} from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import { assertConfigMutationSuccess } from '../helpers/config-object.ts';
import type { Fix } from '../types.ts';

const LEGACY = 'componentSubtitle';
const legacyPath = ['parameters', LEGACY];
const subtitlePath = ['parameters', 'docs', 'subtitle'];

// The Subtitle block read the preview and meta parameters only, and preferred `docs.subtitle`,
// so an existing one keeps winning.
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
      filter: { kind: ['preview'] },
      handler: (code, { id }) => {
        if (!code.includes(LEGACY)) {
          return null;
        }
        const preview = loadConfig(code, id).parse();
        migrate(preview);
        assertConfigMutationSuccess(preview);
        return preview.changed ? formatFileContent(id, formatConfig(preview)) : null;
      },
    },
    {
      filter: { kind: ['story'], id: /\.[cm]?[jt]sx?$/ },
      handler: (code, { id }) => {
        if (!code.includes(LEGACY)) {
          return null;
        }
        const csf = loadCsf(code, { fileName: id, makeTitle: (title) => title ?? id }).parse();
        csf.objects({ stories: false }).forEach(migrate);
        assertConfigMutationSuccess(csf);
        return csf.changed ? formatFileContent(id, printCsf(csf).code) : null;
      },
    },
  ],
};
