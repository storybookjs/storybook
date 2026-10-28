import { type Meta, type Story, isMeta, isStory } from '../../../../csf/index.ts';
import type {
  Args,
  ComponentAnnotations,
  LegacyStoryAnnotationsOrFn,
  ProjectAnnotations,
  Renderer,
} from '@storybook/core/internal/types';

export function getCsfFactoryAnnotations<
  TRenderer extends Renderer = Renderer,
  TArgs extends Args = Args,
>(
  story: LegacyStoryAnnotationsOrFn<TRenderer> | Story<Renderer>,
  meta?: ComponentAnnotations<TRenderer, TArgs> | Meta<Renderer>,
  projectAnnotations?: ProjectAnnotations<TRenderer>
) {
  return isStory(story)
    ? {
        story: story.input,
        meta: story.meta.input,
        preview: story.meta.preview.composed,
      }
    : { story, meta: isMeta(meta) ? meta.input : meta, preview: projectAnnotations };
}
