import { type Meta, type Story, isMeta, isStory } from 'storybook/internal/csf';
import type {
  Args,
  ComponentAnnotations,
  LegacyStoryAnnotationsOrFn,
  NormalizedProjectAnnotations,
  ProjectAnnotations,
  Renderer,
  StoryAnnotations,
} from 'storybook/internal/types';

export function getCsfFactoryAnnotations<
  TRenderer extends Renderer = Renderer,
  TArgs extends Args = Args,
>(
  story: LegacyStoryAnnotationsOrFn<TRenderer> | Story<Renderer>,
  meta?: ComponentAnnotations<TRenderer, TArgs> | Meta<Renderer>,
  projectAnnotations?: ProjectAnnotations<TRenderer>
):
  | {
      story: StoryAnnotations<Renderer, unknown>;
      meta: ComponentAnnotations<Renderer, unknown>;
      preview: NormalizedProjectAnnotations<Renderer>;
    }
  | {
      story: LegacyStoryAnnotationsOrFn<TRenderer>;
      meta:
        | ComponentAnnotations<TRenderer, TArgs>
        | ComponentAnnotations<Renderer, unknown>
        | undefined;
      preview: ProjectAnnotations<TRenderer> | undefined;
    } {
  return isStory(story)
    ? {
        story: story.input,
        meta: story.meta.input,
        preview: story.meta.preview.composed,
      }
    : { story, meta: isMeta(meta) ? meta.input : meta, preview: projectAnnotations };
}
