import type { AddonTypes, StoryContext } from 'storybook/internal/csf';
import { combineTags } from 'storybook/internal/csf';
import type {
  Args,
  ComponentAnnotations,
  ComposedStoryFn,
  DecoratorFunction,
  NormalizedProjectAnnotations,
  ProjectAnnotations,
  Renderer,
  StoryAnnotations,
  TestFunction,
} from 'storybook/internal/types';

import type { OmitIndexSignature, SetOptional, Simplify, UnionToIntersection } from 'type-fest';

import {
  combineParameters,
  composeConfigs,
  composeStory,
  normalizeArrays,
  normalizeProjectAnnotations,
} from '../preview-api/index.ts';
import { mountDestructured } from '../preview-api/modules/preview-web/render/mount-utils.ts';
import { Tag } from '../shared/constants/tags.ts';
import { getCoreAnnotations, markAsComposedWithCoreAnnotations } from './core-annotations.ts';

export interface Preview<TRenderer extends Renderer = Renderer> {
  readonly _tag: 'Preview';
  input: ProjectAnnotations<TRenderer> & { addons?: PreviewAddon<never>[] };
  composed: NormalizedProjectAnnotations<TRenderer>;

  meta<TArgs = Args, TMetaArgKeys extends PropertyKey = never>(
    input: Omit<
      ComponentAnnotations<TRenderer & { args: TArgs }, TArgs & TRenderer['args']>,
      'args'
    > & { args?: MetaArgs<TArgs & TRenderer['args'], TMetaArgKeys> }
  ): Meta<RequireMetaArgs<TRenderer & { args: TArgs }, TMetaArgKeys>, TMetaArgKeys>;

  type<T>(): Preview<TRenderer & T>;
}

export type InferTypes<T extends PreviewAddon<never>[]> = T extends PreviewAddon<infer C>[]
  ? C & { csf4: true }
  : never;

export function definePreview<TRenderer extends Renderer, Addons extends PreviewAddon<never>[]>(
  input: ProjectAnnotations<TRenderer> & { addons?: Addons }
): Preview<TRenderer & InferTypes<Addons>> {
  type TPreviewRenderer = TRenderer & InferTypes<Addons>;
  let composed: NormalizedProjectAnnotations<TPreviewRenderer>;
  const preview = {
    _tag: 'Preview',
    input: input,
    get composed() {
      if (composed) {
        return composed;
      }
      const { addons, ...rest } = input;
      // The composed result already includes the core annotations. Mark it so that downstream
      // consumers (StoryStore / portable setProjectAnnotations) don't prepend them a second time.
      composed = markAsComposedWithCoreAnnotations(
        normalizeProjectAnnotations<TPreviewRenderer>(
          composeConfigs([...getCoreAnnotations(), ...(addons ?? []), rest])
        )
      );
      return composed;
    },
    type() {
      return this;
    },
    meta(meta) {
      return defineMeta(
        meta as ComponentAnnotations<TPreviewRenderer, TPreviewRenderer['args']>,
        this
      );
    },
  } as Preview<TPreviewRenderer>;
  globalThis.globalProjectAnnotations = preview.composed;
  return preview;
}

export interface PreviewAddon<
  in TExtraContext extends AddonTypes = AddonTypes,
> extends ProjectAnnotations<Renderer> {}

export function definePreviewAddon<TExtraContext extends AddonTypes = AddonTypes>(
  preview: ProjectAnnotations<Renderer>
): PreviewAddon<TExtraContext> {
  return preview;
}

export function isPreview(input: unknown): input is Preview<Renderer> {
  return input != null && typeof input === 'object' && '_tag' in input && input?._tag === 'Preview';
}

// Types the `args` of `preview.meta()` by the keys provided. Each value is checked against `TArgs`
// but never used to infer it, so literals don't widen and callbacks get their parameter types. The
// other arg names are listed so editors can suggest them.
type MetaArgs<TArgs, TKeys extends PropertyKey> = string extends TKeys
  ? Partial<NoInfer<TArgs>>
  : {
      [K in TKeys]?: K extends keyof NoInfer<TArgs> ? NoInfer<TArgs>[K] : never;
    } & Partial<Record<Exclude<keyof NoInfer<TArgs>, TKeys>, unknown>>;

// An `Args` record doesn't say which args it sets, so it sets none.
type MetaArgKeys<TArgs, TKeys extends PropertyKey> = string extends TKeys
  ? never
  : TKeys & keyof TArgs;

type WithMetaArgs<TArgs, TKeys extends PropertyKey> = TArgs &
  Required<Pick<TArgs, MetaArgKeys<TArgs, TKeys>>>;

type RequireMetaArgs<TRenderer extends Renderer, TKeys extends PropertyKey> = TRenderer & {
  args: WithMetaArgs<TRenderer['args'], TKeys>;
};

type DecoratorsArgs<TRenderer extends Renderer, Decorators> = UnionToIntersection<
  Decorators extends DecoratorFunction<TRenderer, infer TArgs> ? TArgs : unknown
>;

type InferMetaTypes<TRenderer extends Renderer, TArgs, Decorators> = TRenderer & {
  args: Simplify<TArgs & OmitIndexSignature<DecoratorsArgs<TRenderer, Decorators>>>;
};

/**
 * The input of a renderer's `preview.meta()`, apart from `component` and `render`. `args` are
 * typed by the keys provided, and the meta's own hooks see those args as present.
 */
export type MetaInput<TRenderer extends Renderer, TArgs, Decorators, TKeys extends PropertyKey> = {
  args?: MetaArgs<InferMetaTypes<TRenderer, TArgs, Decorators>['args'], TKeys>;
  decorators?: Decorators | Decorators[];
} & Omit<
  ComponentAnnotations<TRenderer, NoInfer<WithMetaArgs<TArgs & TRenderer['args'], TKeys>>>,
  'args' | 'component' | 'decorators' | 'render'
>;

/**
 * The renderer types of the meta returned by `preview.meta()`: `TArgs` plus the args read by
 * `Decorators`, with the args set in meta present.
 */
export type MetaTypes<
  TRenderer extends Renderer,
  TArgs,
  Decorators,
  TKeys extends PropertyKey,
> = RequireMetaArgs<InferMetaTypes<TRenderer, TArgs, Decorators>, TKeys>;

/** The args a story must still provide: the ones `preview.meta()` didn't set. */
export type StoryArgs<TArgs, TKeys extends PropertyKey> = SetOptional<
  TArgs,
  MetaArgKeys<TArgs, TKeys>
>;

/**
 * Adds the args of a typed `render` to those of the meta's `component`. A `render` typed as `any` or
 * `Args` adds none, and it can't change the types of the component's args.
 */
export type WithRenderArgs<TComponentArgs, TRenderArgs> = TComponentArgs &
  (string extends keyof TRenderArgs ? unknown : Omit<TRenderArgs, keyof TComponentArgs>);

export interface Meta<TRenderer extends Renderer, TMetaArgKeys extends PropertyKey = never> {
  readonly _tag: 'Meta';
  input: Omit<ComponentAnnotations<TRenderer, TRenderer['args']>, 'args'> & {
    args: [MetaArgKeys<TRenderer['args'], TMetaArgKeys>] extends [never]
      ? Partial<TRenderer['args']> | undefined
      : WithMetaArgs<Partial<TRenderer['args']>, TMetaArgKeys>;
  };
  // composed: NormalizedComponentAnnotations<TRenderer>;
  preview: Preview<TRenderer>;

  story(
    input?: () => TRenderer['storyResult']
  ): Story<TRenderer, { render: () => TRenderer['storyResult'] }>;

  story<
    TInput extends StoryAnnotations<
      TRenderer,
      TRenderer['args'],
      StoryArgs<TRenderer['args'], TMetaArgKeys>
    >,
  >(
    input?: TInput
  ): Story<TRenderer, TInput>;

  type<T>(): Meta<TRenderer & T, TMetaArgKeys>;
}

export function isMeta(input: unknown): input is Meta<Renderer> {
  return input != null && typeof input === 'object' && '_tag' in input && input?._tag === 'Meta';
}

function defineMeta<TRenderer extends Renderer>(
  input: ComponentAnnotations<TRenderer, TRenderer['args']>,
  preview: Preview<TRenderer>
): Meta<TRenderer> {
  return {
    _tag: 'Meta',
    input: {
      ...input,
      parameters: { ...input.parameters, csfFactory: true },
    } as Meta<TRenderer>['input'],
    preview,
    type<T>() {
      // `T` only adds types, the meta stays the same object.
      return this as unknown as Meta<TRenderer & T>;
    },
    story(
      story: StoryAnnotations<TRenderer, TRenderer['args']> | (() => TRenderer['storyResult']) = {}
    ) {
      const annotations = typeof story === 'function' ? { render: story } : story;
      // The overloads of `Meta['story']` type the story's input.
      return defineStory(annotations, this) as Story<TRenderer, any>;
    },
  };
}

export interface Story<
  TRenderer extends Renderer,
  TInput extends {
    play?: (...args: never[]) => void;
    render?: (...args: never[]) => TRenderer['storyResult'];
  } = StoryAnnotations<TRenderer, TRenderer['args']>,
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
}

export function isStory<TRenderer extends Renderer>(input: unknown): input is Story<TRenderer> {
  return input != null && typeof input === 'object' && '_tag' in input && input?._tag === 'Story';
}

function defineStory<
  TRenderer extends Renderer,
  TInput extends StoryAnnotations<TRenderer, TRenderer['args']>,
>(
  input: TInput,
  meta: Meta<TRenderer>
): Story<TRenderer, TInput> & {
  __compose: () => ComposedStoryFn<TRenderer>;
  __children: Story<TRenderer>[];
} {
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

  const __children: Story<TRenderer>[] = [];

  return {
    _tag: 'Story',
    input,
    meta,
    __compose: compose,
    __children,
    get composed() {
      const composed = compose();
      const { args, argTypes, parameters, id, tags, globals, storyName: name } = composed;
      return { args, argTypes, parameters, id, tags, name, globals };
    },
    get play() {
      return input.play ?? meta.input?.play ?? (async () => {});
    },
    async run(context) {
      await compose().run(context);
    },
    test(
      name: string,
      overridesOrTestFn: StoryAnnotations<TRenderer, TRenderer['args']> | TestFunction<TRenderer>,
      testFn?: TestFunction<TRenderer, TRenderer['args']>
    ) {
      const annotations = typeof overridesOrTestFn !== 'function' ? overridesOrTestFn : {};
      const testFunction = typeof overridesOrTestFn !== 'function' ? testFn! : overridesOrTestFn;

      const play =
        mountDestructured(this.play) || mountDestructured(testFunction)
          ? // mount needs to be explicitly destructured
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            async ({ mount, context }: StoryContext<TRenderer>) => {
              await this.play?.(context);
              await testFunction(context);
            }
          : async (context: StoryContext<TRenderer>) => {
              await this.play?.(context);
              await testFunction(context);
            };

      const test = this.extend({
        ...annotations,
        name,
        tags: [Tag.TEST_FN, `!${Tag.AUTODOCS}`, ...(annotations.tags ?? [])],
        play,
      });
      __children.push(test);

      return test;
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

export function getStoryChildren<TRenderer extends Renderer>(
  story: Story<TRenderer>
): Story<TRenderer>[] {
  if ('__children' in story) {
    return story.__children as Story<TRenderer>[];
  }
  return [];
}
