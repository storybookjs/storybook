import type { AddonTypes, PlayFunction, StoryContext } from 'storybook/internal/csf';
import { combineTags } from 'storybook/internal/csf';
import type {
  ComponentAnnotations,
  ComposedStoryFn,
  NormalizedComponentAnnotations,
  NormalizedProjectAnnotations,
  NormalizedStoryAnnotations,
  ProjectAnnotations,
  Renderer,
  StoryAnnotations,
} from 'storybook/internal/types';

import {
  combineParameters,
  composeConfigs,
  composeStory,
  normalizeProjectAnnotations,
} from 'storybook/preview-api';

import { getCoreAnnotations } from './core-annotations';

export interface Preview<TRenderer extends Renderer = Renderer> {
  readonly _tag: 'Preview';
  input: ProjectAnnotations<TRenderer> & { addons?: PreviewAddon<never>[] };
  composed: NormalizedProjectAnnotations<TRenderer>;

  meta(input: any): any;
}

export type InferTypes<T extends PreviewAddon<never>[]> = T extends PreviewAddon<infer C>[]
  ? C & { csf4: true }
  : never;

export function definePreview<TRenderer extends Renderer, Addons extends PreviewAddon<never>[]>(
  input: ProjectAnnotations<TRenderer> & { addons?: Addons }
): Preview<TRenderer & InferTypes<Addons>> {
  let composed: NormalizedProjectAnnotations<TRenderer & InferTypes<Addons>>;
  const preview = {
    _tag: 'Preview',
    input: input,
    get composed() {
      if (composed) {
        return composed;
      }
      const { addons, ...rest } = input;
      composed = normalizeProjectAnnotations<TRenderer & InferTypes<Addons>>(
        composeConfigs([...getCoreAnnotations(), ...(addons ?? []), rest])
      );
      return composed;
    },
    meta(meta: ComponentAnnotations<TRenderer & InferTypes<Addons>>) {
      return defineMeta(meta, this);
    },
  } as Preview<TRenderer & InferTypes<Addons>>;
  globalThis.globalProjectAnnotations = preview.composed;
  return preview;
}

export interface PreviewAddon<in TExtraContext extends AddonTypes = AddonTypes>
  extends ProjectAnnotations<Renderer> {}

export function definePreviewAddon<TExtraContext extends AddonTypes = AddonTypes>(
  preview: ProjectAnnotations<Renderer>
): PreviewAddon<TExtraContext> {
  return preview;
}

export function isPreview(input: unknown): input is Preview<Renderer> {
  return input != null && typeof input === 'object' && '_tag' in input && input?._tag === 'Preview';
}

export interface Meta<TRenderer extends Renderer> {
  readonly _tag: 'Meta';
  input: ComponentAnnotations<TRenderer>;
  composed: NormalizedComponentAnnotations<TRenderer>;
  preview: Preview<TRenderer>;

  story<TInput extends StoryAnnotations<TRenderer, TRenderer['args']>>(
    input?: TInput
  ): Story<TRenderer, TInput>;
}

export function isMeta(input: unknown): input is Meta<Renderer> {
  return input != null && typeof input === 'object' && '_tag' in input && input?._tag === 'Meta';
}

function defineMeta(input: any, preview: any): any {
  return {
    _tag: 'Meta',
    input,
    preview,
    get composed(): never {
      throw new Error('Not implemented');
    },
    story(story: any = {}) {
      return defineStory(story, this);
    },
  };
}

export interface Story<
  TRenderer extends Renderer,
  TInput extends StoryAnnotations<TRenderer, TRenderer['args']> = StoryAnnotations<
    TRenderer,
    TRenderer['args']
  >,
> {
  readonly _tag: 'Story';
  input: TInput;
  composed: NormalizedStoryAnnotations<TRenderer> & { args: TRenderer['args'] };
  meta: Meta<TRenderer>;
  __compose: () => ComposedStoryFn<TRenderer>;
  play: PlayFunction<TRenderer, TRenderer['args']>;
  run: (context?: Partial<StoryContext<TRenderer, Partial<TRenderer['args']>>>) => Promise<void>;

  extends<TInput extends StoryAnnotations<TRenderer, TRenderer['args']>>(
    input: TInput
  ): Story<TRenderer, TInput>;
}

export function isStory<TRenderer extends Renderer>(input: unknown): input is Story<TRenderer> {
  return input != null && typeof input === 'object' && '_tag' in input && input?._tag === 'Story';
}

function defineStory<
  TRenderer extends Renderer,
  TInput extends StoryAnnotations<TRenderer, TRenderer['args']>,
>(input: TInput, meta: Meta<TRenderer>): Story<TRenderer, TInput> {
  let composed: ComposedStoryFn<TRenderer>;

  const compose = () => {
    if (!composed) {
      composed = composeStory(
        input as StoryAnnotations<TRenderer>,
        meta.input as ComponentAnnotations<TRenderer>,
        undefined,
        meta.preview.composed
      );
    }
    return composed;
  };
  return {
    _tag: 'Story',
    input,
    meta,
    __compose: compose,
    get composed(): never {
      throw new Error('Not implemented');
    },
    get play() {
      return input.play ?? meta.input?.play ?? (async () => {});
    },
    get run() {
      return compose().run ?? (async () => {});
    },
    extends<TInput extends StoryAnnotations<TRenderer, TRenderer['args']>>(input: TInput) {
      return defineStory(
        {
          ...this.input,
          ...input,
          args: { ...this.input.args, ...input.args },
          argTypes: combineParameters(this.input.argTypes, input.argTypes),
          afterEach: [...(this.input?.afterEach ?? []), ...(input.afterEach ?? [])],
          beforeEach: [...(this.input?.beforeEach ?? []), ...(input.beforeEach ?? [])],
          decorators: [...(this.input?.decorators ?? []), ...(input.decorators ?? [])],
          globals: { ...this.input.globals, ...input.globals },
          loaders: [...(this.input?.loaders ?? []), ...(input.loaders ?? [])],
          parameters: combineParameters(this.input.parameters, input.parameters),
          tags: combineTags(this.input.parameters, input.parameters),
        },
        this.meta
      );
    },
  } as Story<TRenderer, TInput>;
}
