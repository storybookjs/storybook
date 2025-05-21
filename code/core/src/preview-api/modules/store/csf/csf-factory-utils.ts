import { isStory } from 'storybook/internal/csf';
import type {
  Args,
  ComponentAnnotations,
  LegacyStoryAnnotationsOrFn,
  ProjectAnnotations,
  Renderer,
} from 'storybook/internal/types';

export function getCsfFactoryAnnotations<
  TRenderer extends Renderer = Renderer,
  TArgs extends Args = Args,
>(
  story: LegacyStoryAnnotationsOrFn<TRenderer>,
  meta?: ComponentAnnotations<TRenderer, TArgs>,
  projectAnnotations?: ProjectAnnotations<TRenderer>
) {
  return isStory(story)
    ? {
        story: story.input,
        meta: story.meta.input,
        preview: story.meta.preview.composed,
      }
    : { story, meta, preview: projectAnnotations };
}
