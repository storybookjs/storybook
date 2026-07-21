import type { StoryIndex } from 'storybook/internal/types';

import { registerDocsService as registerCoreDocsService } from '../../../../core/src/shared/open-service/services/docs/server.ts';

export type RegisterDocsServiceOptions = {
  getIndex: () => Promise<StoryIndex>;
};

/** Registers the public `core/docs` capability from the addon-docs preset. */
export function registerDocsService(options: RegisterDocsServiceOptions) {
  return registerCoreDocsService(options);
}
