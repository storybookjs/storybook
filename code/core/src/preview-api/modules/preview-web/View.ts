import type { PreparedStory } from 'storybook/internal/types';

export interface View<TStorybookRoot> {
  // Get ready to render a story, returning the element to render to
  prepareForStory(story: PreparedStory<any>, options?: { scrollReset?: boolean }): TStorybookRoot;

  prepareForDocs(options?: { scrollReset?: boolean }): TStorybookRoot;

  showErrorDisplay(err: { message?: string; stack?: string }): void;

  showNoPreview(): void;

  showPreparingStory(options?: { immediate: boolean }): void;

  showPreparingDocs(options?: { immediate: boolean }): void;

  showMain(): void;

  showDocs(): void;

  showStory(): void;

  showStoryDuringRender(): void;
}
