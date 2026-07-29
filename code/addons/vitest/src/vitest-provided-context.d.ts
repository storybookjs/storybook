import 'vitest';

import type {
  STORYBOOK_CORE_GHOST_STORIES_PROVIDE_KEY,
  STORYBOOK_CORE_RENDER_ANALYSIS_PROVIDE_KEY,
  STORYBOOK_TEST_INITIAL_GLOBALS_PROVIDE_KEY,
  STORYBOOK_TEST_PROVIDE_KEY,
} from './constants.ts';

declare module 'vitest' {
  interface ProvidedContext {
    [STORYBOOK_TEST_PROVIDE_KEY]: Record<string, unknown>;
    [STORYBOOK_CORE_GHOST_STORIES_PROVIDE_KEY]: boolean;
    [STORYBOOK_CORE_RENDER_ANALYSIS_PROVIDE_KEY]: boolean;
    [STORYBOOK_TEST_INITIAL_GLOBALS_PROVIDE_KEY]: Record<string, unknown>;
  }
}
