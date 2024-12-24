import { describe, expect, it } from 'vitest';

import type { Renderer, StoryContext } from '@storybook/core/types';

import { defaultDecorateStory } from './decorators';

function makeContext(input: Record<string, any> = {}): StoryContext<Renderer> {
  return {
    id: 'id',
    kind: 'kind',
    name: 'name',
    viewMode: 'story',
    parameters: {},
    ...input,
  } as StoryContext<Renderer>;
}

describe('client-api.decorators', () => {
  it('calls decorators in out to in order', () => {
    const order: number[] = [];
    const decorators = [
      // @ts-expect-error (not defined)
      (s) => order.push(1) && s(),
      // @ts-expect-error (not defined)
      (s) => order.push(2) && s(),
      // @ts-expect-error (not defined)
      (s) => order.push(3) && s(),
    ];
    const decorated = defaultDecorateStory(() => order.push(4), decorators);

    expect(order).toEqual([]);
    decorated(makeContext());
    expect(order).toEqual([3, 2, 1, 4]);
  });

  it('passes context through to sub decorators', () => {
    const contexts: StoryContext[] = [];
    const decorators = [
      // @ts-expect-error (not defined)
      (s, c) => contexts.push(c) && s({ args: { k: 1 } }),
      // @ts-expect-error (not defined)
      (s, c) => contexts.push(c) && s({ args: { k: 2 } }),
      // @ts-expect-error (not defined)
      (s, c) => contexts.push(c) && s({ args: { k: 3 } }),
    ];
    const decorated = defaultDecorateStory((c) => contexts.push(c), decorators);

    expect(contexts).toEqual([]);
    decorated(makeContext({ args: { k: 0 } }));
    expect(contexts.map((c) => c.args.k)).toEqual([0, 3, 2, 1]);
  });

  it('passes context through to sub decorators additively', () => {
    const contexts: StoryContext[] = [];
    const decorators = [
      // @ts-expect-error (not defined)
      (s, c) => contexts.push(c) && s({ args: { a: 1 } }),
      // @ts-expect-error (not defined)
      (s, c) => contexts.push(c) && s({ globals: { g: 2 } }),
    ];
    const decorated = defaultDecorateStory((c) => contexts.push(c), decorators);

    expect(contexts).toEqual([]);
    decorated(makeContext({}));
    expect(contexts.map(({ args, globals }) => ({ args, globals }))).toEqual([
      { args: undefined, globals: undefined },
      { globals: { g: 2 } },
      { args: { a: 1 }, globals: { g: 2 } },
    ]);
  });

  it('does not recreate decorated story functions each time', () => {
    // @ts-expect-error (not defined)
    const decoratedStories = [];
    const decorators = [
      // @ts-expect-error (not defined)
      (s, c) => {
        // @ts-expect-error (not defined)
        decoratedStories.push = s;
        return s();
      },
    ];
    const decorated = defaultDecorateStory(() => 0, decorators);

    decorated(makeContext());
    decorated(makeContext());
    // @ts-expect-error (not defined)
    expect(decoratedStories[0]).toBe(decoratedStories[1]);
  });

  // NOTE: important point--this test would not work if we called `decoratedOne` twice simultaneously
  // both story functions would receive {story: 2}. The assumption here is that we'll never render
  // the same story twice at the same time.
  it('does not interleave contexts if two decorated stories are call simultaneously', async () => {
    const contexts: StoryContext[] = [];
    let resolve: (value?: unknown) => void = () => {};
    const fence = new Promise((r) => {
      resolve = r;
    });
    const decorators = [
      // @ts-expect-error (not defined)
      async (s, c) => {
        // The fence here simulates async-ness in react rendering an element (`<S />` doesn't run `S()` straight away)
        await fence;
        s();
      },
    ];
    const decoratedOne = defaultDecorateStory((c) => contexts.push(c), decorators);
    const decoratedTwo = defaultDecorateStory((c) => contexts.push(c), decorators);

    decoratedOne(makeContext({ value: 1 }));
    decoratedTwo(makeContext({ value: 2 }));

    resolve();
    await fence;

    expect(contexts[0].value).toBe(1);
    expect(contexts[1].value).toBe(2);
  });

  it('DOES NOT merge core metadata or pass through core metadata keys in context', () => {
    const contexts: StoryContext[] = [];
    const decorators = [
      // @ts-expect-error (not defined)
      (s, c) =>
        contexts.push(c) &&
        s({ parameters: { c: 'd' }, id: 'notId', kind: 'notKind', name: 'notName' }),
    ];
    const decorated = defaultDecorateStory((c) => contexts.push(c), decorators);

    expect(contexts).toEqual([]);
    decorated(makeContext({ parameters: { a: 'b' } }));
    expect(contexts).toEqual([
      expect.objectContaining({ parameters: { a: 'b' }, id: 'id', kind: 'kind', name: 'name' }),
      expect.objectContaining({ parameters: { a: 'b' }, id: 'id', kind: 'kind', name: 'name' }),
    ]);
  });
});
