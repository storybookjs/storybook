import type { PreparedStory } from '@storybook/core/types';

export interface View<TStorybookRoot> {
  // Get ready to render a story, returning the element to render to
  prepareForStory(story: PreparedStory<any>): TStorybookRoot;

  prepareForDocs(): TStorybookRoot;

  showErrorDisplay(err: { message?: string; stack?: string }): void;

  showNoPreview(): void;

  showPreparingStory(options?: { immediate: boolean }): void;

  showPreparingDocs(options?: { immediate: boolean }): void;

  showMain(): void;

  showDocs(): void;

  showStory(): void;

  showStoryDuringRender(): void;
}
