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
} from '@storybook/core/types';

import { composeConfigs, normalizeProjectAnnotations } from '@storybook/core/preview-api';

export interface Preview<TRenderer extends Renderer = Renderer> {
  readonly _tag: 'Preview';
  input: ProjectAnnotations<TRenderer>;
  composed: NormalizedProjectAnnotations<TRenderer>;

  meta(input: ComponentAnnotations<TRenderer>): Meta<TRenderer>;
}

export function definePreview<TRenderer extends Renderer>(
  input: Preview<TRenderer>['input']
): Preview<TRenderer> {
  let composed: NormalizedProjectAnnotations<TRenderer>;
  const preview: Preview<TRenderer> = {
    _tag: 'Preview',
    input,
    get composed() {
      if (composed) {
        return composed;
      }
      const { addons, ...rest } = input;
      composed = normalizeProjectAnnotations<TRenderer>(composeConfigs([...(addons ?? []), rest]));
      return composed;
    },
    meta(meta: ComponentAnnotations<TRenderer>) {
      return defineMeta(meta, this);
    },
  };
  globalThis.globalProjectAnnotations = preview.composed;
  return preview;
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

function defineMeta<TRenderer extends Renderer>(
  input: ComponentAnnotations<TRenderer>,
  preview: Preview<TRenderer>
): Meta<TRenderer> {
  return {
    _tag: 'Meta',
    input,
    preview,
    get composed(): never {
      throw new Error('Not implemented');
    },
    story(story: StoryAnnotations<TRenderer>) {
      return defineStory(story, this);
    },
  };
}

export interface Story<TRenderer extends Renderer, TArgs extends Args = Args> {
  readonly _tag: 'Story';
  input: StoryAnnotations<TRenderer, TArgs>;
  composed: NormalizedStoryAnnotations<TRenderer>;
  meta: Meta<TRenderer, TArgs>;
}

function defineStory<TRenderer extends Renderer>(
  input: ComponentAnnotations<TRenderer>,
  meta: Meta<TRenderer>
): Story<TRenderer> {
  return {
    _tag: 'Story',
    input,
    meta,
    get composed(): never {
      throw new Error('Not implemented');
    },
  };
}

export function isStory<TRenderer extends Renderer>(input: unknown): input is Story<TRenderer> {
  return input != null && typeof input === 'object' && '_tag' in input && input?._tag === 'Story';
}
