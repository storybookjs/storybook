import type { StoryStore } from 'storybook/internal/preview-api';
import type { Renderer } from 'storybook/internal/types';

declare global {
  interface Window {
    __STORYBOOK_STORY_STORE__: StoryStore<Renderer>;
  }
}
