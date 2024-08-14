import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ArgsEnhancer,
  NormalizedComponentAnnotations,
  NormalizedStoryAnnotations,
  PreparedStory,
  ProjectAnnotations,
  Renderer,
  SBScalarType,
  StoryContext,
} from '@storybook/core/types';
import { global } from '@storybook/global';

import { HooksContext, addons } from '../../addons';
import { UNTARGETED } from '../args';
import { composeConfigs } from './composeConfigs';
import { normalizeProjectAnnotations } from './normalizeProjectAnnotations';
import { prepareContext, prepareMeta, prepareStory as realPrepareStory } from './prepareStory';

vi.mock('@storybook/global', async (importOriginal) => ({
  global: {
    ...(await importOriginal<typeof import('@storybook/global')>()),
  },
}));

const id = 'id';
const name = 'name';
const title = 'title';
const render = () => {};
const moduleExport = {};

const stringType: SBScalarType = { name: 'string' };
const numberType: SBScalarType = { name: 'number' };
const booleanType: SBScalarType = { name: 'boolean' };

// Normalize the project annotations to mimick live behavior
export function prepareStory<TRenderer extends Renderer>(
  storyAnnotations: NormalizedStoryAnnotations<TRenderer>,
  componentAnnotations: NormalizedComponentAnnotations<TRenderer>,
  projectAnnotations: ProjectAnnotations<TRenderer>
): PreparedStory<TRenderer> {
  return realPrepareStory(
    storyAnnotations,
    componentAnnotations,
    normalizeProjectAnnotations(composeConfigs([projectAnnotations]))
  );
}
// Extra fields that must be added to the story context after enhancers
const addExtraContext = (
  context: PreparedStory & Pick<StoryContext, 'args' | 'globals'>
): StoryContext => {
  const extraContext: StoryContext = {
    ...context,
    hooks: new HooksContext(),
    viewMode: 'story' as const,
    loaded: {},
    mount: vi.fn(),
    abortSignal: new AbortController().signal,
    canvasElement: {},
    step: vi.fn(),
    context: null! as StoryContext,
    canvas: null!,
    globalTypes: {},
  };
  extraContext.context = extraContext;
  return extraContext;
};

describe('prepareStory', () => {
  describe('tags', () => {
    it('story tags override component', () => {
      const { tags } = prepareStory(
        { id, name, tags: ['story-1', 'story-2'], moduleExport },
        {
          id,
          title,
          tags: ['component-1', 'component-2'],
        },
        { render }
      );

      expect(tags).toEqual(['dev', 'test', 'component-1', 'component-2', 'story-1', 'story-2']);
    });

    it('component tags work if story are unset', () => {
      const { tags } = prepareStory(
        { id, name, moduleExport },
        {
          id,
          title,
          tags: ['component-1', 'component-2'],
        },
        { render }
      );

      expect(tags).toEqual(['dev', 'test', 'component-1', 'component-2']);
    });

    it('sets a value even if annotations do not have tags', () => {
      const { tags } = prepareStory({ id, name, moduleExport }, { id, title }, { render });

      expect(tags).toEqual(['dev', 'test']);
    });
  });

  describe('parameters', () => {
    it('are combined in the right order', () => {
      const { parameters } = prepareStory(
        { id, name, parameters: { a: 'story', nested: { z: 'story' } }, moduleExport },
        {
          id,
          title,
          parameters: {
            a: { name: 'component' },
            b: { name: 'component' },
            nested: { z: { name: 'component' }, y: { name: 'component' } },
          },
        },
        {
          render,
          parameters: {
            a: { name: 'global' },
            b: { name: 'global' },
            c: { name: 'global' },
            nested: { z: { name: 'global' }, x: { name: 'global' } },
          },
        }
      );

      expect(parameters).toEqual({
        __isArgsStory: false,
        a: 'story',
        b: { name: 'component' },
        c: { name: 'global' },
        nested: { z: 'story', y: { name: 'component' }, x: { name: 'global' } },
      });
    });

    it('sets a value even if annotations do not have parameters', () => {
      const { parameters } = prepareStory(
        { id, name, moduleExport },
        { id, title },
        { render: (args: any) => {} }
      );

      expect(parameters).toEqual({ __isArgsStory: true });
    });

    it('does not set `__isArgsStory` if `render` does not take args', () => {
      const { parameters } = prepareStory(
        { id, name, moduleExport },
        { id, title },
        { render: () => {} }
      );

      expect(parameters).toEqual({ __isArgsStory: false });
    });
  });

  describe('args/initialArgs', () => {
    it('are combined in the right order', () => {
      const { initialArgs } = prepareStory(
        { id, name, args: { a: 'story', nested: { z: 'story' } }, moduleExport },
        {
          id,
          title,
          args: {
            a: 'component',
            b: 'component',
            nested: { z: 'component', y: 'component' },
          },
        },
        {
          render,
          args: {
            a: 'global',
            b: 'global',
            c: 'global',
            nested: { z: 'global', x: 'global' },
          },
        }
      );

      expect(initialArgs).toEqual({
        a: 'story',
        b: 'component',
        c: 'global',
        nested: { z: 'story' },
      });
    });

    it('can be overridden by `undefined`', () => {
      const { initialArgs } = prepareStory(
        { id, name, args: { a: undefined }, moduleExport },
        { id, title, args: { a: 'component' } },
        { render }
      );
      expect(initialArgs).toEqual({ a: undefined });
    });

    it('sets a value even if annotations do not have args', () => {
      const { initialArgs } = prepareStory({ id, name, moduleExport }, { id, title }, { render });

      expect(initialArgs).toEqual({});
    });

    describe('argsEnhancers', () => {
      it('are applied in the right order', () => {
        const run: number[] = [];
        const enhancerOne: ArgsEnhancer<Renderer> = () => {
          run.push(1);
          return {};
        };
        const enhancerTwo: ArgsEnhancer<Renderer> = () => {
          run.push(2);
          return {};
        };

        prepareStory(
          { id, name, moduleExport },
          { id, title },
          { render, argsEnhancers: [enhancerOne, enhancerTwo] }
        );

        expect(run).toEqual([1, 2]);
      });

      it('allow you to add args', () => {
        const enhancer = vi.fn(() => ({ c: 'd' }));

        const { initialArgs } = prepareStory(
          { id, name, args: { a: 'b' }, moduleExport },
          { id, title },
          { render, argsEnhancers: [enhancer] }
        );

        expect(enhancer).toHaveBeenCalledWith(expect.objectContaining({ initialArgs: { a: 'b' } }));
        expect(initialArgs).toEqual({ a: 'b', c: 'd' });
      });

      it('passes result of earlier enhancers into subsequent ones, and composes their output', () => {
        const enhancerOne = vi.fn(() => ({ b: 'B' }));
        const enhancerTwo = vi.fn(({ initialArgs }) =>
          Object.entries(initialArgs).reduce(
            (acc, [key, val]) => ({ ...acc, [key]: `enhanced ${val}` }),
            {}
          )
        );
        const enhancerThree = vi.fn(() => ({ c: 'C' }));

        const { initialArgs } = prepareStory(
          { id, name, args: { a: 'A' }, moduleExport },
          { id, title },
          { render, argsEnhancers: [enhancerOne, enhancerTwo, enhancerThree] }
        );

        expect(enhancerOne).toHaveBeenCalledWith(
          expect.objectContaining({ initialArgs: { a: 'A' } })
        );
        expect(enhancerTwo).toHaveBeenCalledWith(
          expect.objectContaining({ initialArgs: { a: 'A', b: 'B' } })
        );
        expect(enhancerThree).toHaveBeenCalledWith(
          expect.objectContaining({ initialArgs: { a: 'enhanced A', b: 'enhanced B' } })
        );
        expect(initialArgs).toEqual({
          a: 'enhanced A',
          b: 'enhanced B',
          c: 'C',
        });
      });
    });
  });

  describe('argTypes', () => {
    it('are combined in the right order', () => {
      const { argTypes } = prepareStory(
        {
          id,
          name,
          argTypes: {
            a: { name: 'a-story', type: booleanType },
            nested: { name: 'nested', type: booleanType, a: 'story' },
          },
          moduleExport,
        },
        {
          id,
          title,
          argTypes: {
            a: { name: 'a-component', type: stringType },
            b: { name: 'b-component', type: stringType },
            nested: { name: 'nested', type: booleanType, a: 'component', b: 'component' },
          },
        },
        {
          render,
          argTypes: {
            a: { name: 'a-global', type: numberType },
            b: { name: 'b-global', type: numberType },
            c: { name: 'c-global', type: numberType },
            nested: { name: 'nested', type: booleanType, a: 'global', b: 'global', c: 'global' },
          },
        }
      );

      expect(argTypes).toEqual({
        a: { name: 'a-story', type: booleanType },
        b: { name: 'b-component', type: stringType },
        c: { name: 'c-global', type: numberType },
        nested: { name: 'nested', type: booleanType, a: 'story', b: 'component', c: 'global' },
      });
    });
    describe('argTypesEnhancers', () => {
      it('allows you to alter argTypes when stories are added', () => {
        const enhancer = vi.fn((context) => ({ ...context.argTypes, c: { name: 'd' } }));
        const { argTypes } = prepareStory(
          { id, name, argTypes: { a: { name: 'b' } }, moduleExport },
          { id, title },
          { render, argTypesEnhancers: [enhancer] }
        );

        expect(enhancer).toHaveBeenCalledWith(
          expect.objectContaining({ argTypes: { a: { name: 'b' } } })
        );
        expect(argTypes).toEqual({ a: { name: 'b' }, c: { name: 'd' } });
      });

      it('does not merge argType enhancer results', () => {
        const enhancer = vi.fn(() => ({ c: { name: 'd' } }));
        const { argTypes } = prepareStory(
          { id, name, argTypes: { a: { name: 'b' } }, moduleExport },
          { id, title },
          { render, argTypesEnhancers: [enhancer] }
        );

        expect(enhancer).toHaveBeenCalledWith(
          expect.objectContaining({ argTypes: { a: { name: 'b' } } })
        );
        expect(argTypes).toEqual({ c: { name: 'd' } });
      });

      it('recursively passes argTypes to successive enhancers', () => {
        const firstEnhancer = vi.fn((context) => ({ ...context.argTypes, c: { name: 'd' } }));
        const secondEnhancer = vi.fn((context) => ({ ...context.argTypes, e: { name: 'f' } }));
        const { argTypes } = prepareStory(
          { id, name, argTypes: { a: { name: 'b' } }, moduleExport },
          { id, title },
          { render, argTypesEnhancers: [firstEnhancer, secondEnhancer] }
        );

        expect(firstEnhancer).toHaveBeenCalledWith(
          expect.objectContaining({ argTypes: { a: { name: 'b' } } })
        );
        expect(secondEnhancer).toHaveBeenCalledWith(
          expect.objectContaining({ argTypes: { a: { name: 'b' }, c: { name: 'd' } } })
        );
        expect(argTypes).toEqual({ a: { name: 'b' }, c: { name: 'd' }, e: { name: 'f' } });
      });
    });
  });

  describe('globals => storyGlobals', () => {
    it('are combined in the right order', () => {
      const { storyGlobals } = prepareStory(
        {
          id,
          name,
          globals: {
            a: 'a-story',
            b: 'b-story',
          },
          moduleExport,
        },
        {
          id,
          title,
          globals: {
            a: 'a-component',
            c: 'c-component',
          },
        },
        { render }
      );

      expect(storyGlobals).toEqual({
        a: 'a-story',
        b: 'b-story',
        c: 'c-component',
      });
    });
  });

  describe('applyLoaders', () => {
    const abortSignal = new AbortController().signal;
    it('awaits the result of a loader', async () => {
      const loader = vi.fn(async () => new Promise((r) => setTimeout(() => r({ foo: 7 }), 100)));
      const { applyLoaders } = prepareStory(
        { id, name, loaders: [loader as any], moduleExport },
        { id, title },
        { render }
      );

      const storyContext = { abortSignal } as StoryContext;
      const loaded = await applyLoaders(storyContext);

      expect(loader).toHaveBeenCalledWith(storyContext);
      expect(loaded).toMatchInlineSnapshot(`
        {
          "foo": 7,
        }
      `);
    });

    it('loaders are composed in the right order', async () => {
      const globalLoader = async () => ({ foo: 1, bar: 1, baz: 1 });
      const componentLoader = async () => ({ foo: 3, bar: 3 });
      const storyLoader = async () => ({ foo: 5 });

      const { applyLoaders } = prepareStory(
        { id, name, loaders: [storyLoader], moduleExport },
        { id, title, loaders: [componentLoader] },
        { render, loaders: [globalLoader] }
      );

      expect(await applyLoaders({ abortSignal } as StoryContext)).toMatchInlineSnapshot(`
        {
          "bar": 3,
          "baz": 1,
          "foo": 5,
        }
      `);
    });

    it('later loaders override earlier loaders', async () => {
      const loaders: any[] = [
        async () => new Promise((r) => setTimeout(() => r({ foo: 7 }), 100)),
        async () => new Promise((r) => setTimeout(() => r({ foo: 3 }), 50)),
      ];

      const { applyLoaders } = prepareStory(
        { id, name, loaders, moduleExport },
        { id, title },
        { render }
      );

      expect(await applyLoaders({ abortSignal: abortSignal } as StoryContext))
        .toMatchInlineSnapshot(`
        {
          "foo": 3,
        }
      `);
    });
  });

  describe('undecoratedStoryFn', () => {
    it('args are mapped by argTypes[x].mapping', () => {
      const renderMock = vi.fn();
      const story = prepareStory(
        {
          id,
          name,
          argTypes: {
            one: { name: 'one', type: { name: 'string' }, mapping: { 1: 'mapped' } },
            two: { name: 'two', type: { name: 'string' }, mapping: { 1: 'no match' } },
          },
          args: { one: 1, two: 2, three: 3 },
          moduleExport,
        },
        { id, title },
        { render: renderMock }
      );

      const context = prepareContext({ args: story.initialArgs, globals: {}, ...story });
      story.undecoratedStoryFn(addExtraContext(context));
      expect(renderMock).toHaveBeenCalledWith(
        { one: 'mapped', two: 2, three: 3 },
        expect.objectContaining({ args: { one: 'mapped', two: 2, three: 3 } })
      );
    });
  });

  describe('storyFn', () => {
    it('produces a story with inherited decorators applied', () => {
      const renderMock = vi.fn();
      const globalDecorator = vi.fn((s) => s());
      const componentDecorator = vi.fn((s) => s());
      const storyDecorator = vi.fn((s) => s());
      const story = prepareStory(
        {
          id,
          name,
          decorators: [storyDecorator],
          moduleExport,
        },
        { id, title, decorators: [componentDecorator] },
        { render: renderMock, decorators: [globalDecorator] }
      );

      addons.setChannel({ on: vi.fn(), removeListener: vi.fn() } as any);
      const hooks = new HooksContext();
      story.unboundStoryFn({ args: story.initialArgs, hooks, ...story } as any);

      expect(globalDecorator).toHaveBeenCalled();
      expect(componentDecorator).toHaveBeenCalled();
      expect(storyDecorator).toHaveBeenCalled();
      expect(renderMock).toHaveBeenCalled();

      hooks.clean();
    });

    it('prepared context is applied to decorators', () => {
      const renderMock = vi.fn();
      let ctx1;
      let ctx2;
      let ctx3;

      const globalDecorator = vi.fn((fn, ctx) => {
        ctx1 = ctx;
        return fn();
      });
      const componentDecorator = vi.fn((fn, ctx) => {
        ctx2 = ctx;
        return fn();
      });
      const storyDecorator = vi.fn((fn, ctx) => {
        ctx3 = ctx;
        return fn();
      });
      const story = prepareStory(
        {
          id,
          name,
          argTypes: {
            one: { name: 'one', type: { name: 'string' }, mapping: { 1: 'mapped-1' } },
          },
          args: { one: 1 },
          decorators: [storyDecorator],
          moduleExport,
        },
        { id, title, decorators: [componentDecorator] },
        { render: renderMock, decorators: [globalDecorator] }
      );

      const hooks = new HooksContext();
      const context = prepareContext({ args: story.initialArgs, globals: {}, ...story });
      story.unboundStoryFn(addExtraContext(context));

      expect(ctx1).toMatchObject({ unmappedArgs: { one: 1 }, args: { one: 'mapped-1' } });
      expect(ctx2).toMatchObject({ unmappedArgs: { one: 1 }, args: { one: 'mapped-1' } });
      expect(ctx3).toMatchObject({ unmappedArgs: { one: 1 }, args: { one: 'mapped-1' } });

      hooks.clean();
    });
  });

  describe('mapping', () => {
    it('maps labels to values in prepareContext', () => {
      const story = prepareStory(
        {
          id,
          name,
          argTypes: {
            one: { name: 'one', mapping: { 1: 'mapped-1' } },
          },
          moduleExport,
        },
        { id, title },
        { render: vi.fn<any>() }
      );

      const context = prepareContext({ args: { one: 1 }, globals: {}, ...story });
      expect(context).toMatchObject({
        args: { one: 'mapped-1' },
      });
    });

    it('maps arrays of labels to values in prepareContext', () => {
      const story = prepareStory(
        {
          id,
          name,
          argTypes: {
            one: { name: 'one', mapping: { 1: 'mapped-1' } },
          },
          moduleExport,
        },
        { id, title },
        { render: vi.fn<any>() }
      );

      const context = prepareContext({
        args: { one: [1, 1] },
        globals: {},
        ...story,
      });
      expect(context).toMatchObject({
        args: { one: ['mapped-1', 'mapped-1'] },
      });
    });
  });

  describe('with `FEATURES.argTypeTargetsV7`', () => {
    beforeEach(() => {
      global.FEATURES = { argTypeTargetsV7: true };
    });
    it('filters out targeted args', () => {
      const renderMock = vi.fn();
      const firstStory = prepareStory(
        {
          id,
          name,
          args: { a: 1, b: 2 },
          argTypes: { b: { name: 'b', target: 'foo' } },
          moduleExport,
        },
        { id, title },
        { render: renderMock }
      );

      const context = prepareContext({ args: firstStory.initialArgs, globals: {}, ...firstStory });
      firstStory.unboundStoryFn(addExtraContext(context));
      expect(renderMock).toHaveBeenCalledWith(
        { a: 1 },
        expect.objectContaining({ args: { a: 1 }, allArgs: { a: 1, b: 2 } })
      );
    });

    it('filters out conditional args', () => {
      const renderMock = vi.fn();
      const firstStory = prepareStory(
        {
          id,
          name,
          args: { a: 1, b: 2 },
          argTypes: { b: { name: 'b', if: { arg: 'a', truthy: false } } },
          moduleExport,
        },
        { id, title },
        { render: renderMock }
      );

      const context = prepareContext({ args: firstStory.initialArgs, globals: {}, ...firstStory });
      firstStory.unboundStoryFn(addExtraContext(context));
      expect(renderMock).toHaveBeenCalledWith(
        { a: 1 },
        expect.objectContaining({ args: { a: 1 }, allArgs: { a: 1, b: 2 } })
      );
    });

    it('adds argsByTarget to context', () => {
      const renderMock = vi.fn();
      const firstStory = prepareStory(
        {
          id,
          name,
          args: { a: 1, b: 2 },
          argTypes: { b: { name: 'b', target: 'foo' } },
          moduleExport,
        },
        { id, title },
        { render: renderMock }
      );

      const context = prepareContext({ args: firstStory.initialArgs, globals: {}, ...firstStory });
      firstStory.unboundStoryFn(addExtraContext(context));
      expect(renderMock).toHaveBeenCalledWith(
        { a: 1 },
        expect.objectContaining({ argsByTarget: { [UNTARGETED]: { a: 1 }, foo: { b: 2 } } })
      );
    });

    it('always sets args, even when all are targetted', () => {
      const renderMock = vi.fn();
      const firstStory = prepareStory(
        {
          id,
          name,
          args: { b: 2 },
          argTypes: { b: { name: 'b', target: 'foo' } },
          moduleExport,
        },
        { id, title },
        { render: renderMock }
      );

      const context = prepareContext({ args: firstStory.initialArgs, globals: {}, ...firstStory });
      firstStory.unboundStoryFn(addExtraContext(context));
      expect(renderMock).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ argsByTarget: { foo: { b: 2 } } })
      );
    });

    it('always sets args, even when none are set for the story', () => {
      const renderMock = vi.fn();
      const firstStory = prepareStory(
        {
          id,
          name,
          moduleExport,
        },
        { id, title },
        { render: renderMock }
      );

      const context = prepareContext({ args: firstStory.initialArgs, globals: {}, ...firstStory });
      firstStory.unboundStoryFn(addExtraContext(context));
      expect(renderMock).toHaveBeenCalledWith({}, expect.objectContaining({ argsByTarget: {} }));
    });
  });
});

describe('playFunction', () => {
  it('awaits play if defined', async () => {
    const inner = vi.fn();
    const play = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 0)); // Ensure this puts an async boundary in
      inner();
    });
    const { playFunction } = prepareStory(
      { id, name, play, moduleExport },
      { id, title },
      { render }
    );

    await playFunction?.({} as StoryContext);
    expect(play).toHaveBeenCalled();
    expect(inner).toHaveBeenCalled();
  });

  it('provides step via runStep', async () => {
    const stepPlay = vi.fn((context) => {
      expect(context).not.toBeUndefined();
      expect(context.step).toEqual(expect.any(Function));
    });
    const play = vi.fn(async ({ step }) => {
      await step('label', stepPlay);
    });
    const runStep = vi.fn((label, p, c) => p(c));
    const { playFunction, runStep: preparedRunStep } = prepareStory(
      { id, name, play, moduleExport },
      { id, title },
      { render, runStep }
    );

    const context: Partial<StoryContext> = {
      step: (label, playFn) => preparedRunStep(label, playFn, context as StoryContext),
    };
    await playFunction?.(context as StoryContext);
    expect(play).toHaveBeenCalled();
    expect(stepPlay).toHaveBeenCalled();
    expect(runStep).toBeCalledWith('label', expect.any(Function), expect.any(Object));
  });
});

describe('moduleExport', () => {
  it('are carried through from the story annotations', () => {
    const storyObj = {};
    const story = prepareStory({ id, name, moduleExport: storyObj }, { id, title }, { render });
    expect(story.moduleExport).toBe(storyObj);
  });
});

describe('prepareMeta', () => {
  it('returns a similar object as prepareStory', () => {
    const meta = {
      id,
      title,
      moduleExport,
      tags: ['some-tag'],
      parameters: {
        a: { name: 'component' },
        b: { name: 'component' },
        nested: { z: { name: 'component' }, y: { name: 'component' } },
      },
      args: {
        a: 'component',
        b: 'component',
        nested: { z: 'component', y: 'component' },
      },
      argTypes: {
        a: { name: 'a-story', type: booleanType },
        nested: { name: 'nested', type: booleanType, a: 'story' },
      },
    };

    // omitting the properties from preparedStory that are not in preparedMeta
    const {
      name: storyName,
      story,
      applyLoaders,
      applyBeforeEach,
      originalStoryFn,
      unboundStoryFn,
      undecoratedStoryFn,
      playFunction,
      runStep,
      mount,
      renderToCanvas,
      testingLibraryRender,
      usesMount,
      ...preparedStory
    } = prepareStory({ id, name, moduleExport }, meta, { render });

    const preparedMeta = prepareMeta(
      meta,
      normalizeProjectAnnotations(composeConfigs([{ render }])),
      {}
    );

    // prepareMeta doesn't explicitly set this parameter to false
    // eslint-disable-next-line no-underscore-dangle
    preparedMeta.parameters.__isArgsStory = false;

    expect(preparedMeta).toEqual(preparedStory);
  });
});
