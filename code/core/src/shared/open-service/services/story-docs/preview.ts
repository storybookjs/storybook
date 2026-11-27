import { definePreviewAddon } from 'storybook/internal/csf';

import type { ServiceInstanceOf } from 'storybook/open-service';

import { getSourceSnippetRuntime } from '../../../../docs-tools/storyDocsCodePanel.ts';

import { registerService } from '../../preview.ts';
import { storyDocsServiceDef } from './definition.ts';
import { storyDocsSourceBeforeEach } from './story-docs-source-before-each.ts';

export type StoryDocsService = ServiceInstanceOf<typeof storyDocsServiceDef>;

export default () => {
  if (getSourceSnippetRuntime() !== 'server') {
    return definePreviewAddon({});
  }

  return definePreviewAddon({
    beforeAll: () => {
      registerService(storyDocsServiceDef);
    },
    beforeEach: storyDocsSourceBeforeEach,
  });
};
