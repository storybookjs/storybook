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
import { mountDestructured } from '../preview-api/modules/preview-web/render/mount-utils';
import { Tag } from '../shared/constants/tags';
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

  const __children: Story<TRenderer>[] = [];

  return {
    _tag: 'Story',
    input,
    meta,
    // @ts-expect-error this is a private property used only once in renderers/react/src/preview
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
    ): void {
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

      return test as unknown as void;
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
