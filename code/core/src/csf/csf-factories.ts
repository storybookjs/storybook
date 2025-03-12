/* eslint-disable no-underscore-dangle */
import type {
  Args,
  ComponentAnnotations,
  NormalizedComponentAnnotations,
  NormalizedProjectAnnotations,
  NormalizedStoryAnnotations,
  ProjectAnnotations,
  Renderer,
  StoryAnnotations,
} from 'storybook/internal/types';

export interface Preview<TRenderer extends Renderer = Renderer> {
  readonly _tag: 'Preview';
  input: ProjectAnnotations<TRenderer>;
  composed: NormalizedProjectAnnotations<TRenderer>;

  meta(input: ComponentAnnotations<TRenderer>): Meta<TRenderer>;
}

export function isPreview(input: unknown): input is Preview<Renderer> {
  return input != null && typeof input === 'object' && '_tag' in input && input?._tag === 'Preview';
}

export interface Meta<TRenderer extends Renderer, TArgs extends Args = Args> {
  readonly _tag: 'Meta';
  input: ComponentAnnotations<TRenderer, TArgs>;
  composed: NormalizedComponentAnnotations<TRenderer>;
  preview: Preview<TRenderer>;

  story(input: StoryAnnotations<TRenderer, TArgs>): Story<TRenderer, TArgs>;
}

export function isMeta(input: unknown): input is Meta<Renderer> {
  return input != null && typeof input === 'object' && '_tag' in input && input?._tag === 'Meta';
}

export interface Story<TRenderer extends Renderer, TArgs extends Args = Args> {
  readonly _tag: 'Story';
  input: StoryAnnotations<TRenderer, TArgs>;
  composed: NormalizedStoryAnnotations<TRenderer>;
  meta: Meta<TRenderer, TArgs>;
}

export function isStory<TRenderer extends Renderer>(input: unknown): input is Story<TRenderer> {
  return input != null && typeof input === 'object' && '_tag' in input && input?._tag === 'Story';
}
