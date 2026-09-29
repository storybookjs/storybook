/**
 * @vitest-environment happy-dom
 */

import { createRawSnippet, mount, type ComponentProps, type Snippet } from 'svelte';
import type { StoryContext as StorybookStoryContext } from 'storybook/internal/types';
import { describe, expectTypeOf, it } from 'vitest';

import type StoryComponent from './runtime/Story.svelte';

import { defineMeta, type StoryContext } from './index.ts';
import type {
  StoryAnnotations,
  StoryComponent as StoryComponentType,
  StoryContext as BaseStoryContext,
  SvelteRenderer,
} from './types.ts';

import Button from './__examples__/components/Button.svelte';

describe(defineMeta.name, () => {
  it('works with provided meta entry "component" entry', () => {
    const { Story } = defineMeta({
      component: Button,
      args: {
        children: createRawSnippet(() => ({
          render: () => 'Click me',
        })),
        onclick: (event) => {
          expectTypeOf(event).not.toBeAny();
          expectTypeOf(event).toEqualTypeOf<
            MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
          >();
        },
      },
      play(context) {
        expectTypeOf(context).not.toBeAny();
        expectTypeOf(context).toMatchTypeOf<StorybookStoryContext<SvelteRenderer<typeof Button>>>();
      },
    });

    type TStoryComponent = StoryComponentType<ComponentProps<typeof Button>, typeof Button>;

    expectTypeOf(Story).toEqualTypeOf<TStoryComponent>();
    // The Story.svelte component must fit the type that `defineMeta` declares for it
    expectTypeOf<
      typeof StoryComponent<ComponentProps<typeof Button>, typeof Button>
    >().toMatchTypeOf<TStoryComponent>();
  });
});

describe("component 'Story' destructured from 'defineMeta", () => {
  it("creates valid types inside the 'args' attribute (prop)", () => {
    const { Story } = defineMeta({
      component: Button,
      args: {
        children: createRawSnippet(() => ({
          render: () => 'Click me',
        })),
        onclick: (event) => {
          expectTypeOf(event).not.toBeAny();
          expectTypeOf(event).toEqualTypeOf<
            MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
          >();
        },
      },
      play(context) {
        expectTypeOf(context).not.toBeAny();
        expectTypeOf(context).toMatchTypeOf<StorybookStoryContext<SvelteRenderer<typeof Button>>>();
      },
    });

    type TStoryProps = ComponentProps<typeof Story>;

    expectTypeOf<TStoryProps>().not.toBeNever();
    expectTypeOf<TStoryProps['name']>().toBeNullable();
    expectTypeOf<TStoryProps['exportName']>().toBeNullable();
    expectTypeOf<TStoryProps['play']>().toBeNullable();
    expectTypeOf<TStoryProps['args']>().toBeNullable();
    expectTypeOf<NonNullable<TStoryProps['args']>>().toMatchTypeOf<
      Partial<ComponentProps<typeof Button>>
    >();
  });
});

describe("component 'Story' rejects invalid props", () => {
  it('rejects wrong arg types, a missing name, and template together with children', () => {
    const { Story } = defineMeta({ component: Button });
    type TStoryProps = ComponentProps<typeof Story>;
    const snippet = (() => {}) as unknown as Snippet<[any, any]>;

    const valid: TStoryProps = { name: 'Primary', args: { primary: true } };
    // @ts-expect-error `primary` is a boolean
    const wrongArg: TStoryProps = { name: 'Primary', args: { primary: 'yes' } };
    // @ts-expect-error a story needs `name` or `exportName`
    const noName: TStoryProps = { args: { primary: true } };
    // @ts-expect-error `template` and `children` can't be used together
    const both: TStoryProps = { name: 'Primary', template: snippet, children: snippet };

    expectTypeOf(valid).not.toBeAny();
    expectTypeOf([wrongArg, noName, both]).not.toBeAny();
  });
});
