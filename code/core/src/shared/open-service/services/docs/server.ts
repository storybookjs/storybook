import type { StoryIndex } from 'storybook/internal/types';

import { registerService } from '../../server.ts';
import { docsServiceDef } from './definition.ts';
import { clearDocsRuntime, setDocsRuntime } from './runtime.ts';

export type RegisterDocsServiceOptions = {
  getIndex: () => Promise<StoryIndex>;
};

/** Registers the `core/docs` open service with its story-index dependency. */
export function registerDocsService(options: RegisterDocsServiceOptions) {
  setDocsRuntime({ getIndex: options.getIndex });
  return registerService(docsServiceDef);
}

export { clearDocsRuntime };
