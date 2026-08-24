import { definePreviewAddon } from 'storybook/internal/csf';

import { registerService } from '../../preview.ts';
import { storyDocsServiceDef } from './definition.ts';

export const registerStoryDocsPreviewService = () => registerService(storyDocsServiceDef);

export default () => {
  const useStoryDocsService =
    'FEATURES' in globalThis && globalThis.FEATURES?.experimentalDocgenServer;

  if (!useStoryDocsService) {
    return definePreviewAddon({});
  }

  return definePreviewAddon({
    beforeAll: () => {
      registerStoryDocsPreviewService();
    },
  });
};
