import type { StoryIndex } from 'storybook/internal/types';

import { registerPublicApi } from '../../../public-api/index.ts';
import { createDocsApi } from './definition.ts';

export type RegisterDocsApiOptions = {
  getIndex: () => Promise<StoryIndex>;
};

/** Registers the public docs API with its story-index dependency. */
export function registerDocsApi(options: RegisterDocsApiOptions) {
  const docsApi = createDocsApi(options);
  registerPublicApi([docsApi]);
  return docsApi;
}
