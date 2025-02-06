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
  StoryContext,
} from '@storybook/core/types';

import { composeConfigs, normalizeProjectAnnotations } from '@storybook/core/preview-api';

export interface Preview<TRenderer extends Renderer = Renderer> {
  readonly _tag: 'Preview';
  input: ProjectAnnotations<TRenderer>;
  composed: NormalizedProjectAnnotations<TRenderer>;

  meta(input: ComponentAnnotations<TRenderer>): Meta<TRenderer>;
}

export function definePreview<TRenderer extends Renderer>(
  preview: Preview<TRenderer>['input']
): Preview<TRenderer> {
  return {
    _tag: 'Preview',
    input: preview,
    get composed() {
      const { addons, ...rest } = preview;
      return normalizeProjectAnnotations<TRenderer>(composeConfigs([...(addons ?? []), rest]));
    },
    meta(meta: ComponentAnnotations<TRenderer>) {
      return defineMeta(meta, this);
    },
  };
}

export function isPreview(input: unknown): input is Preview<Renderer> {
  return input != null && typeof input === 'object' && '_tag' in input && input?._tag === 'Preview';
}

export interface Meta<TRenderer extends Renderer, TArgs extends Args = Args> {
  readonly _tag: 'Meta';
  input: ComponentAnnotations<TRenderer, TArgs>;
  composed: NormalizedComponentAnnotations<TRenderer>;
  preview: Preview<TRenderer>;

  story(input: ComponentAnnotations<TRenderer, TArgs>): Story<TRenderer, TArgs>;
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

type StoryTestFn = (context: StoryContext) => void | Promise<void>;

export interface Story<TRenderer extends Renderer, TArgs extends Args = Args> {
  readonly _tag: 'Story';
  input: StoryAnnotations<TRenderer, TArgs> & {
    _tests: Map<string, { fn: StoryTestFn; options: any }>;
  };
  composed: NormalizedStoryAnnotations<TRenderer>;
  meta: Meta<TRenderer, TArgs>;
  test: (name: string, fn: StoryTestFn, options?: any) => void;
  runTest(name: string): Promise<void>;
}

function defineStory<TRenderer extends Renderer>(
  input: ComponentAnnotations<TRenderer>,
  meta: Meta<TRenderer>
): Story<TRenderer> {
  return {
    _tag: 'Story',
    input: {
      ...input,
      _tests: new Map(),
    },
    meta,
    get composed(): never {
      throw new Error('Not implemented');
    },
    test: function (name: string, fn: StoryTestFn, options?: any) {
      this.input._tests.set(name, { fn, options });
    },
    runTest: async function (name: string) {
      const test = this.input._tests.get(name);
      if (!test) {
        throw new Error(`Test with name "${name}" not found.`);
      }
      // @ts-expect-error TODO: Figure out how to pass the correct context with canvasElement etc.
      // like it's done in portable stories
      await test.fn(this.input);
    },
  };
}

export function isStory<TRenderer extends Renderer>(input: unknown): input is Story<TRenderer> {
  return input != null && typeof input === 'object' && '_tag' in input && input?._tag === 'Story';
}
