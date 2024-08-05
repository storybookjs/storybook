import type { Renderer } from '@storybook/core/types';
import type { StoryStore } from 'storybook/internal/preview-api';

declare global {
  interface Window {
    __STORYBOOK_STORY_STORE__: StoryStore<Renderer>;
  }
}
