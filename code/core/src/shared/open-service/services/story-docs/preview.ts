import { definePreviewAddon } from '../../../../csf/index.ts';

import type { ServiceInstanceOf } from '@storybook/core/open-service';

import { getFeatures } from '../../../features.ts';
import { registerService } from '../../preview.ts';
import { storyDocsServiceDef } from './definition.ts';
import { storyDocsSourceBeforeEach } from './story-docs-source-before-each.ts';

export type StoryDocsService = ServiceInstanceOf<typeof storyDocsServiceDef>;

export default () => {
  const useStaticServiceSnippets = getFeatures().docgenServer;

  if (!useStaticServiceSnippets) {
    return definePreviewAddon({});
  }

  return definePreviewAddon({
    beforeAll: () => {
      registerService(storyDocsServiceDef);
    },
    beforeEach: storyDocsSourceBeforeEach,
  });
};
