import type { AddonTypes, StoryContext } from 'storybook/internal/csf';
import { combineTags } from 'storybook/internal/csf';
import type {
  Args,
  ComponentAnnotations,
  ComposedStoryFn,
  NormalizedProjectAnnotations,
  ProjectAnnotations,
  Renderer,
  StoryAnnotations,
  TestFunction,
} from 'storybook/internal/types';

import {
  combineParameters,
  composeConfigs,
  composeStory,
  normalizeArrays,
  normalizeProjectAnnotations,
} from '../preview-api/index';
import { getCoreAnnotations } from './core-annotations';

export interface Preview<TRenderer extends Renderer = Renderer> {
  readonly _tag: 'Preview';
  input: ProjectAnnotations<TRenderer> & { addons?: PreviewAddon<never>[] };
  composed: NormalizedProjectAnnotations<TRenderer>;

  meta<TArgs extends Args, TInput extends ComponentAnnotations<TRenderer & { args: TArgs }, TArgs>>(
    input: TInput
  ): Meta<TRenderer & { args: TArgs }, TInput>;
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
    meta(meta) {
      // @ts-expect-error hard
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

export interface Meta<
  TRenderer extends Renderer,
  TInput extends ComponentAnnotations<TRenderer, TRenderer['args']> = ComponentAnnotations<
    TRenderer,
    TRenderer['args']
  >,
> {
  readonly _tag: 'Meta';
  input: TInput;
  // composed: NormalizedComponentAnnotations<TRenderer>;
  preview: Preview<TRenderer>;

  story(
    input?: () => TRenderer['storyResult']
  ): Story<TRenderer, { render: () => TRenderer['storyResult'] }>;

  story<TInput extends StoryAnnotations<TRenderer, TRenderer['args']>>(
    input?: TInput
  ): Story<TRenderer, TInput>;
}

export function isMeta(input: unknown): input is Meta<Renderer> {
  return input != null && typeof input === 'object' && '_tag' in input && input?._tag === 'Meta';
}

function defineMeta<
  TRenderer extends Renderer,
  TInput extends ComponentAnnotations<TRenderer, TRenderer['args']> = ComponentAnnotations<
    TRenderer,
    TRenderer['args']
  >,
>(input: TInput, preview: Preview<TRenderer>): Meta<TRenderer, TInput> {
  return {
    _tag: 'Meta',
    input,
    preview,
    get composed() {
      // TODO: check this later
      return composeConfigs([preview.input, input]);
    },
    // @ts-expect-error hard
    story(
      story: StoryAnnotations<TRenderer, TRenderer['args']> | (() => TRenderer['storyResult']) = {}
    ) {
      return defineStory(typeof story === 'function' ? { render: story } : story, this);
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
  composed: Pick<
    ComposedStoryFn<TRenderer>,
    'argTypes' | 'parameters' | 'id' | 'tags' | 'globals'
  > & {
    args: TRenderer['args'];
    name: string;
  };
  meta: Meta<TRenderer>;
  __compose: () => ComposedStoryFn<TRenderer>;
  play: TInput['play'];
  run: (
    context?: Partial<StoryContext<TRenderer, Partial<TRenderer['args']>>>,
    testName?: string
  ) => Promise<void>;

  extend<TInput extends StoryAnnotations<TRenderer, TRenderer['args']>>(
    input: TInput
  ): Story<TRenderer, TInput>;
  test(name: string, fn: TestFunction<TRenderer>): void;
  test(
    name: string,
    annotations: StoryAnnotations<TRenderer, TRenderer['args']>,
    fn: TestFunction<TRenderer>
  ): void;
  __testFunction?: TestFunction<TRenderer>;
}

export function isStory<TRenderer extends Renderer>(input: unknown): input is Story<TRenderer> {
  return input != null && typeof input === 'object' && '_tag' in input && input?._tag === 'Story';
}

function defineStory<
  TRenderer extends Renderer,
  TInput extends StoryAnnotations<TRenderer, TRenderer['args']>,
>(input: TInput, meta: Meta<TRenderer>): Story<TRenderer, TInput> {
  let composed: ComposedStoryFn<TRenderer>;
  input.__tests ??= {};
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
    get composed() {
      const composed = compose();
      const { args, argTypes, parameters, id, tags, globals, storyName: name } = composed;
      return { args, argTypes, parameters, id, tags, name, globals };
    },
    get play() {
      return input.play ?? meta.input?.play ?? (async () => {});
    },
    get run() {
      return compose().run ?? (async () => {});
    },
    test(
      name: string,
      overridesOrTestFn: StoryAnnotations<TRenderer, TRenderer['args']> | TestFunction<TRenderer>,
      testFn?: TestFunction<TRenderer>
    ): void {
      const hasOverrides = typeof overridesOrTestFn !== 'function';
      const annotations = (hasOverrides ? overridesOrTestFn : {}) as StoryAnnotations<
        TRenderer,
        TRenderer['args']
      >;
      const testFunction = (hasOverrides ? testFn : overridesOrTestFn) as TestFunction<TRenderer>;

      // A test is a clone of the story + the test function
      const testStory = this.extend({ ...annotations, tags: ['test-fn'] });
      testStory.input.__testFunction = testFunction;
      this.input.__tests![name] = testStory;
    },
    extend<TInput extends StoryAnnotations<TRenderer, TRenderer['args']>>(input: TInput) {
      return defineStory(
        {
          ...this.input,
          ...input,
          args: { ...(this.input.args || {}), ...input.args },
          argTypes: combineParameters(this.input.argTypes, input.argTypes),
          afterEach: [
            ...normalizeArrays(this.input?.afterEach ?? []),
            ...normalizeArrays(input.afterEach ?? []),
          ],
          beforeEach: [
            ...normalizeArrays(this.input?.beforeEach ?? []),
            ...normalizeArrays(input.beforeEach ?? []),
          ],
          decorators: [
            ...normalizeArrays(this.input?.decorators ?? []),
            ...normalizeArrays(input.decorators ?? []),
          ],
          globals: { ...this.input.globals, ...input.globals },
          loaders: [
            ...normalizeArrays(this.input?.loaders ?? []),
            ...normalizeArrays(input.loaders ?? []),
          ],
          parameters: combineParameters(this.input.parameters, input.parameters),
          tags: combineTags(...(this.input.tags ?? []), ...(input.tags ?? [])),
        },
        this.meta
      );
    },
  };
}
