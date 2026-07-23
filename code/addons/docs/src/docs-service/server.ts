import type { StoryIndex } from 'storybook/internal/types';

import { registerDocsApi as registerCoreDocsApi } from '../../../../core/src/shared/open-service/services/docs/server.ts';

export type RegisterDocsApiOptions = {
  getIndex: () => Promise<StoryIndex>;
};

/** Registers the public docs capability from the addon-docs preset. */
export function registerDocsApi(options: RegisterDocsApiOptions) {
  return registerCoreDocsApi(options);
}
