// this file tests Typescript types that's why there are no assertions
import { describe, expectTypeOf, it } from 'vitest';

import { satisfies } from 'storybook/internal/common';
import type {
  Args,
  Canvas,
  ComponentAnnotations,
  StoryAnnotations,
} from 'storybook/internal/types';

import type { Component, ComponentProps } from 'svelte';

import Button from './__test__/Button.svelte';
import Decorator2 from './__test__/Decorator2.svelte';
import Decorator1 from './__test__/Decorator.svelte';
import type { Decorator, Meta, StoryObj } from './public-types';
import type { SvelteRenderer } from './types';

type SvelteStory<Comp extends Component<any, any, any>, Args, RequiredArgs> = StoryAnnotations<
  SvelteRenderer<Comp>,
  Args,
  RequiredArgs
>;

describe('Meta', () => {
  it('Generic parameter of Meta can be a component', () => {
    const meta: Meta<typeof Button> = {
      component: Button,
      args: {
        label: 'good',
        disabled: false,
      },
    };

    expectTypeOf(meta).toExtend<
      ComponentAnnotations<SvelteRenderer<typeof Button>, { disabled: boolean; label: string }>
    >();
  });

  it('Generic parameter of Meta can be the props of the component', () => {
    const meta: Meta<{ disabled: boolean; label: string }> = {
      component: Button,
      args: { label: 'good', disabled: false },
    };

    expectTypeOf(meta).toExtend<
      ComponentAnnotations<SvelteRenderer, { disabled: boolean; label: string }>
    >();
  });
});

describe('StoryObj', () => {
  it('✅ Required args may be provided partial in meta and the story', () => {
    const _meta = satisfies<Meta<typeof Button>>()({
      component: Button,
      args: { label: 'good' },
    });

    type Actual = StoryObj<typeof _meta>;
    type Expected = SvelteStory<
      typeof Button,
      { disabled: boolean; label: string },
      { disabled: boolean; label?: string }
    >;
    expectTypeOf<Actual>().toExtend<Expected>();
  });

  it('❌ The combined shape of meta args and story args must match the required args.', () => {
    {
      const _meta = satisfies<Meta<typeof Button>>()({ component: Button });

      type Expected = SvelteStory<
        typeof Button,
        { disabled: boolean; label: string },
        { disabled: boolean; label: string }
      >;
      expectTypeOf<StoryObj<typeof _meta>>().toExtend<Expected>();
    }
    {
      const _meta = satisfies<Meta<typeof Button>>()({
        component: Button,
        args: { label: 'good' },
      });
      // @ts-expect-error disabled not provided ❌
      const Basic: StoryObj<typeof _meta> = {};

      type Expected = SvelteStory<
        typeof Button,
        { disabled: boolean; label: string },
        { disabled: boolean; label?: string }
      >;
      expectTypeOf(Basic).toExtend<Expected>();
    }
    {
      const _meta = satisfies<Meta<{ label: string; disabled: boolean }>>()({ component: Button });
      const Basic: StoryObj<typeof _meta> = {
        // @ts-expect-error disabled not provided ❌
        args: { label: 'good' },
      };

      type Expected = SvelteStory<
        typeof Button,
        { disabled: boolean; label: string },
        { disabled: boolean; label: string }
      >;
      expectTypeOf(Basic).toExtend<Expected>();
    }
  });

  it('Component can be used as generic parameter for StoryObj', () => {
    expectTypeOf<StoryObj<typeof Button>>().toExtend<
      SvelteStory<
        typeof Button,
        { disabled: boolean; label: string },
        { disabled?: boolean; label?: string }
      >
    >();
  });
});

type ThemeData = 'light' | 'dark';

describe('Story args can be inferred', () => {
  it('Correct args are inferred when type is widened for render function', () => {
    const _meta = satisfies<Meta<ComponentProps<typeof Button> & { theme: ThemeData }>>()({
      component: Button,
      args: { disabled: false },
      render: (args, { component }) => {
        return {
          Component: component,
          props: args,
        };
      },
    });

    const Basic: StoryObj<typeof _meta> = { args: { theme: 'light', label: 'good' } };

    type Expected = SvelteStory<
      typeof Button,
      { theme: ThemeData; disabled: boolean; label: string },
      { theme: ThemeData; disabled?: boolean; label: string }
    >;
    expectTypeOf(Basic).toExtend<Expected>();
  });

  const withDecorator: Decorator<{ decoratorArg: string }> = (
    _storyFn,
    { args: { decoratorArg } }
  ) => ({
    Component: Decorator1,
    props: { decoratorArg },
  });

  it('Correct args are inferred when type is widened for decorators', () => {
    type Props = ComponentProps<typeof Button> & { decoratorArg: string };

    const _meta = satisfies<Meta<Props>>()({
      component: Button,
      args: { disabled: false },
      decorators: [withDecorator],
    });

    const Basic: StoryObj<typeof _meta> = { args: { decoratorArg: 'title', label: 'good' } };

    type Expected = SvelteStory<
      typeof Button,
      Props,
      { decoratorArg: string; disabled?: boolean; label: string }
    >;
    expectTypeOf(Basic).toExtend<Expected>();
  });

  it('Correct args are inferred when type is widened for multiple decorators', () => {
    type Props = ComponentProps<typeof Button> & { decoratorArg: string; decoratorArg2: string };

    const secondDecorator: Decorator<{ decoratorArg2: string }> = (
      _storyFn,
      { args: { decoratorArg2 } }
    ) => ({
      Component: Decorator2,
      props: { decoratorArg2 },
    });

    const _meta = satisfies<Meta<Props>>()({
      component: Button,
      args: { disabled: false },
      decorators: [withDecorator, secondDecorator],
    });

    const Basic: StoryObj<typeof _meta> = {
      args: { decoratorArg: '', decoratorArg2: '', label: 'good' },
    };

    type Expected = SvelteStory<
      typeof Button,
      Props,
      { decoratorArg: string; decoratorArg2: string; disabled?: boolean; label: string }
    >;
    expectTypeOf(Basic).toExtend<Expected>();
  });
});

it('mount accepts a Component and props', () => {
  const Basic: StoryObj<typeof Button> = {
    async play({ mount }) {
      const canvas = await mount(Button, { props: { label: 'label', disabled: true } });
      expectTypeOf(canvas).toExtend<Canvas>();
    },
  };
  expectTypeOf(Basic).toExtend<StoryObj<typeof Button>>();
});

it('StoryObj can accept args directly', () => {
  const _Story: StoryObj<Args> = {
    args: {},
  };

  const _Story2: StoryObj<{ prop: boolean }> = {
    args: {
      prop: true,
    },
  };
});
