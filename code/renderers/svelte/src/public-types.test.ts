/* eslint-disable @typescript-eslint/no-shadow */
// this file tests Typescript types that's why there are no assertions
import { describe, it } from 'vitest';

import { satisfies } from 'storybook/internal/common';
import type {
  Args,
  Canvas,
  ComponentAnnotations,
  StoryAnnotations,
} from 'storybook/internal/types';

import { expectTypeOf } from 'expect-type';
import { type Component, type ComponentProps, SvelteComponent } from 'svelte';

import Button from './__test__/Button.svelte';
import ButtonV5 from './__test__/ButtonV5.svelte';
import Decorator2 from './__test__/Decorator2.svelte';
import Decorator1 from './__test__/Decorator.svelte';
import type { Decorator, Meta, StoryObj } from './public-types';
import type { SvelteRenderer } from './types';

type SvelteStory<
  Comp extends SvelteComponent | Component<any, any, any>,
  Args,
  RequiredArgs,
> = StoryAnnotations<SvelteRenderer<Comp>, Args, RequiredArgs>;

describe('Meta', () => {
  it('Generic parameter of Meta can be a component', () => {
    const meta: Meta<Button> = {
      component: Button,
      args: {
        label: 'good',
        disabled: false,
      },
    };

    expectTypeOf(meta).toMatchTypeOf<
      ComponentAnnotations<SvelteRenderer<Button>, { disabled: boolean; label: string }>
    >();
  });

  it('Generic parameter of Meta can be a Svelte 5 component', () => {
    const meta: Meta<typeof ButtonV5> = {
      component: ButtonV5,
      args: {
        label: 'good',
        disabled: false,
      },
    };

    expectTypeOf(meta).toMatchTypeOf<
      ComponentAnnotations<SvelteRenderer<typeof ButtonV5>, { disabled: boolean; label: string }>
    >();
  });

  it('Generic parameter of Meta can be the props of the component', () => {
    const meta: Meta<{ disabled: boolean; label: string }> = {
      component: Button,
      args: { label: 'good', disabled: false },
    };

    expectTypeOf(meta).toMatchTypeOf<
      ComponentAnnotations<SvelteRenderer, { disabled: boolean; label: string }>
    >();
  });

  it('Events are inferred from component', () => {
    const meta: Meta<Button> = {
      component: Button,
      args: {
        label: 'good',
        disabled: false,
      },
      render: (args) => ({
        Component: Button,
        props: args,
        on: {
          mousemove: (event) => {
            expectTypeOf(event).toMatchTypeOf<MouseEvent>();
          },
        },
      }),
    };
    expectTypeOf(meta).toMatchTypeOf<Meta<Button>>();
  });

  it('Events fallback to custom events when no component is specified', () => {
    const meta: Meta<{ disabled: boolean; label: string }> = {
      component: Button,
      args: { label: 'good', disabled: false },
      render: (args) => ({
        Component: Button,
        props: args,
        on: {
          mousemove: (event) => {
            expectTypeOf(event).toMatchTypeOf<CustomEvent>();
          },
        },
      }),
    };
    expectTypeOf(meta).toMatchTypeOf<Meta<Button>>();
  });
});

describe('StoryObj', () => {
  it('✅ Required args may be provided partial in meta and the story', () => {
    const meta = satisfies<Meta<Button>>()({
      component: Button,
      args: { label: 'good' },
    });

    type Actual = StoryObj<typeof meta>;
    type Expected = SvelteStory<
      Button,
      { disabled: boolean; label: string },
      { disabled: boolean; label?: string }
    >;
    expectTypeOf<Actual>().toMatchTypeOf<Expected>();
  });

  it('✅ Required args may be provided partial in meta and the story (Svelte 4, non-isomorphic type)', () => {
    // The imported Svelte component in Svelte 5 has an isomorphic type (both function and class).
    // In order to test how it would look like for real Svelte 4 components, we need to create the class type manually.
    class Button extends SvelteComponent<{
      disabled: boolean;
      label: string;
    }> {}

    const meta = satisfies<Meta<Button>>()({
      component: Button,
      args: { label: 'good' },
    });

    type Actual = StoryObj<typeof meta>;
    type Expected = SvelteStory<
      Button,
      { disabled: boolean; label: string },
      { disabled: boolean; label?: string }
    >;
    expectTypeOf<Actual>().toMatchTypeOf<Expected>();
  });

  it('✅ Required args may be provided partial in meta and the story (Svelte 5)', () => {
    const meta = satisfies<Meta<typeof ButtonV5>>()({
      component: ButtonV5,
      args: { label: 'good' },
    });

    type Actual = StoryObj<typeof meta>;
    type Expected = SvelteStory<
      typeof ButtonV5,
      { disabled: boolean; label: string },
      { disabled: boolean; label?: string }
    >;
    expectTypeOf<Actual>().toMatchTypeOf<Expected>();
  });

  it('❌ The combined shape of meta args and story args must match the required args.', () => {
    {
      const meta = satisfies<Meta<Button>>()({ component: Button });

      type Expected = SvelteStory<
        Button,
        { disabled: boolean; label: string },
        { disabled: boolean; label: string }
      >;
      expectTypeOf<StoryObj<typeof meta>>().toMatchTypeOf<Expected>();
    }
    {
      const meta = satisfies<Meta<Button>>()({
        component: Button,
        args: { label: 'good' },
      });
      // @ts-expect-error disabled not provided ❌
      const Basic: StoryObj<typeof meta> = {};

      type Expected = SvelteStory<
        Button,
        { disabled: boolean; label: string },
        { disabled: boolean; label?: string }
      >;
      expectTypeOf(Basic).toMatchTypeOf<Expected>();
    }
    {
      const meta = satisfies<Meta<{ label: string; disabled: boolean }>>()({ component: Button });
      const Basic: StoryObj<typeof meta> = {
        // @ts-expect-error disabled not provided ❌
        args: { label: 'good' },
      };

      type Expected = SvelteStory<
        Button,
        { disabled: boolean; label: string },
        { disabled: boolean; label: string }
      >;
      expectTypeOf(Basic).toMatchTypeOf<Expected>();
    }
  });

  it('Component can be used as generic parameter for StoryObj', () => {
    expectTypeOf<StoryObj<Button>>().toMatchTypeOf<
      SvelteStory<
        Button,
        { disabled: boolean; label: string },
        { disabled?: boolean; label?: string }
      >
    >();
  });

  it('Svelte 5 Component can be used as generic parameter for StoryObj', () => {
    expectTypeOf<StoryObj<typeof ButtonV5>>().toMatchTypeOf<
      SvelteStory<
        typeof ButtonV5,
        { disabled: boolean; label: string },
        { disabled?: boolean; label?: string }
      >
    >();
  });
});

type ThemeData = 'light' | 'dark';

describe('Story args can be inferred', () => {
  it('Correct args are inferred when type is widened for render function', () => {
    const meta = satisfies<Meta<ComponentProps<Button> & { theme: ThemeData }>>()({
      component: Button,
      args: { disabled: false },
      render: (args, { component }) => {
        return {
          Component: component,
          props: args,
        };
      },
    });

    const Basic: StoryObj<typeof meta> = { args: { theme: 'light', label: 'good' } };

    type Expected = SvelteStory<
      Button,
      { theme: ThemeData; disabled: boolean; label: string },
      { theme: ThemeData; disabled?: boolean; label: string }
    >;
    expectTypeOf(Basic).toMatchTypeOf<Expected>();
  });

  const withDecorator: Decorator<{ decoratorArg: string }> = (
    _storyFn,
    { args: { decoratorArg } }
  ) => ({
    Component: Decorator1,
    props: { decoratorArg },
  });

  it('Correct args are inferred when type is widened for decorators', () => {
    type Props = ComponentProps<Button> & { decoratorArg: string };

    const meta = satisfies<Meta<Props>>()({
      component: Button,
      args: { disabled: false },
      decorators: [withDecorator],
    });

    const Basic: StoryObj<typeof meta> = { args: { decoratorArg: 'title', label: 'good' } };

    type Expected = SvelteStory<
      Button,
      Props,
      { decoratorArg: string; disabled?: boolean; label: string }
    >;
    expectTypeOf(Basic).toMatchTypeOf<Expected>();
  });

  it('Correct args are inferred when type is widened for multiple decorators', () => {
    type Props = ComponentProps<Button> & { decoratorArg: string; decoratorArg2: string };

    const secondDecorator: Decorator<{ decoratorArg2: string }> = (
      _storyFn,
      { args: { decoratorArg2 } }
    ) => ({
      Component: Decorator2,
      props: { decoratorArg2 },
    });

    const meta = satisfies<Meta<Props>>()({
      component: Button,
      args: { disabled: false },
      decorators: [withDecorator, secondDecorator],
    });

    const Basic: StoryObj<typeof meta> = {
      args: { decoratorArg: '', decoratorArg2: '', label: 'good' },
    };

    type Expected = SvelteStory<
      Button,
      Props,
      { decoratorArg: string; decoratorArg2: string; disabled?: boolean; label: string }
    >;
    expectTypeOf(Basic).toMatchTypeOf<Expected>();
  });
});

it('mount accepts a Component and props', () => {
  const Basic: StoryObj<Button> = {
    async play({ mount }) {
      const canvas = await mount(Button, { props: { label: 'label', disabled: true } });
      expectTypeOf(canvas).toMatchTypeOf<Canvas>();
    },
  };
  expectTypeOf(Basic).toMatchTypeOf<StoryObj<Button>>();
});

it('mount accepts a Svelte 5 Component and props', () => {
  const Basic: StoryObj<typeof ButtonV5> = {
    async play({ mount }) {
      const canvas = await mount(ButtonV5, { props: { label: 'label', disabled: true } });
      expectTypeOf(canvas).toMatchTypeOf<Canvas>();
    },
  };
  expectTypeOf(Basic).toMatchTypeOf<StoryObj<typeof ButtonV5>>();
});

it('StoryObj can accept args directly', () => {
  const Story: StoryObj<Args> = {
    args: {},
  };

  const Story2: StoryObj< { prop: boolean }> = {
    args: {
      prop: true,
    },
  };
});
