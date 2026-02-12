// @vitest-environment happy-dom
/** @jsxImportSource preact */
// this file tests TypeScript types — that's why there are no runtime assertions
import { describe, it } from 'vitest';

import { satisfies } from 'storybook/internal/common';
import type { Args, StoryAnnotations, StrictArgs } from 'storybook/internal/types';

import { expectTypeOf } from 'expect-type';
import { h } from 'preact';
import type { FunctionComponent, VNode } from 'preact';
import type { SetOptional } from 'type-fest';

import type { Decorator, Meta, StoryObj } from './public-types';
import type { PreactRenderer } from './types';

type PreactStory<TArgs, TRequiredArgs> = StoryAnnotations<PreactRenderer, TArgs, TRequiredArgs>;

type ButtonProps = { label: string; disabled: boolean };
const Button: FunctionComponent<ButtonProps> = () => h('div', null);

describe('Meta correctly extracts props from component types', () => {
  it('✅ Meta<typeof Component> extracts component props', () => {
    const meta = satisfies<Meta<typeof Button>>()({
      component: Button,
      args: { label: 'good', disabled: false },
    });

    expectTypeOf(meta.args).toMatchTypeOf<Partial<ButtonProps>>();
  });

  it('✅ Meta<Props> still works when passing props directly', () => {
    const meta = satisfies<Meta<ButtonProps>>()({
      component: Button,
      args: { label: 'good', disabled: false },
    });

    expectTypeOf(meta.args).toMatchTypeOf<Partial<ButtonProps>>();
  });

  it('✅ Meta can be used without generic', () => {
    expectTypeOf({ component: Button }).toMatchTypeOf<Meta>();
  });
});

describe('Args can be provided in multiple ways', () => {
  it('✅ All required args may be provided in meta', () => {
    const meta = satisfies<Meta<typeof Button>>()({
      component: Button,
      args: { label: 'good', disabled: false },
    });

    type Story = StoryObj<typeof meta>;
    const Basic: Story = {};

    expectTypeOf(Basic).toEqualTypeOf<
      PreactStory<ButtonProps, SetOptional<ButtonProps, 'label' | 'disabled'>>
    >();
  });

  it('✅ Required args may be provided partial in meta and the story', () => {
    const meta = satisfies<Meta<typeof Button>>()({
      component: Button,
      args: { label: 'good' },
    });
    const Basic: StoryObj<typeof meta> = {
      args: { disabled: false },
    };

    type Expected = PreactStory<ButtonProps, SetOptional<ButtonProps, 'label'>>;
    expectTypeOf(Basic).toEqualTypeOf<Expected>();
  });

  it('❌ The combined shape of meta args and story args must match the required args.', () => {
    {
      const meta = satisfies<Meta<typeof Button>>()({ component: Button });
      const Basic: StoryObj<typeof meta> = {
        // @ts-expect-error disabled not provided ❌
        args: { label: 'good' },
      };

      type Expected = PreactStory<ButtonProps, ButtonProps>;
      expectTypeOf(Basic).toEqualTypeOf<Expected>();
    }
    {
      const meta = satisfies<Meta<typeof Button>>()({
        component: Button,
        args: { label: 'good' },
      });
      // @ts-expect-error disabled not provided ❌
      const Basic: StoryObj<typeof meta> = {};

      type Expected = PreactStory<ButtonProps, SetOptional<ButtonProps, 'label'>>;
      expectTypeOf(Basic).toEqualTypeOf<Expected>();
    }
    {
      const meta = satisfies<Meta<ButtonProps>>()({ component: Button });
      const Basic: StoryObj<typeof meta> = {
        // @ts-expect-error disabled not provided ❌
        args: { label: 'good' },
      };

      type Expected = PreactStory<ButtonProps, ButtonProps>;
      expectTypeOf(Basic).toEqualTypeOf<Expected>();
    }
  });

  it('Component can be used as generic parameter for StoryObj', () => {
    type Expected = PreactStory<ButtonProps, Partial<ButtonProps>>;
    expectTypeOf<StoryObj<typeof Button>>().toEqualTypeOf<Expected>();
  });
});

it('StoryObj<typeof meta> is allowed when meta is upcasted to Meta<Props>', () => {
  expectTypeOf<StoryObj<Meta<ButtonProps>>>().toEqualTypeOf<
    PreactStory<ButtonProps, Partial<ButtonProps>>
  >();
});

it('StoryObj<typeof meta> is allowed when meta is upcasted to Meta<typeof Cmp>', () => {
  expectTypeOf<StoryObj<Meta<typeof Button>>>().toEqualTypeOf<
    PreactStory<ButtonProps, Partial<ButtonProps>>
  >();
});

it('StoryObj<typeof meta> is allowed when all arguments are optional', () => {
  expectTypeOf<StoryObj<Meta<{ label?: string }>>>().toEqualTypeOf<
    PreactStory<{ label?: string }, { label?: string }>
  >();
});

it('Props can be defined as interfaces, issue #21768', () => {
  interface Props {
    label: string;
  }

  const Component: FunctionComponent<Props> = ({ label }) => h('span', null, label);

  const withDecorator: Decorator = (Story) => h(Story, null);

  const meta = {
    component: Component,
    args: {
      label: 'label',
    },
    decorators: [withDecorator],
  } satisfies Meta<Props>;

  const Basic: StoryObj<typeof meta> = {};

  type Expected = PreactStory<Props, SetOptional<Props, 'label'>>;
  expectTypeOf(Basic).toEqualTypeOf<Expected>();
});

it('Components without Props can be used, issue #21768', () => {
  const Component: FunctionComponent = () => h('div', null);
  const withDecorator: Decorator = (Story) => h(Story, null);

  const meta = {
    component: Component,
    decorators: [withDecorator],
  } satisfies Meta<typeof Component>;

  const Basic: StoryObj<typeof meta> = {};

  type Expected = PreactStory<{}, {}>;
  expectTypeOf(Basic).toEqualTypeOf<Expected>();
});

describe('Story args can be inferred', () => {
  it('Correct args are inferred when type is widened for render function', () => {
    type ThemeData = 'light' | 'dark';
    type Props = ButtonProps & { theme: ThemeData };

    const meta = satisfies<Meta<Props>>()({
      component: Button,
      args: { disabled: false },
      render: (args) => {
        return h('div', null, args.label);
      },
    });

    const Basic: StoryObj<typeof meta> = { args: { theme: 'light', label: 'good' } };

    type Expected = PreactStory<Props, SetOptional<Props, 'disabled'>>;
    expectTypeOf(Basic).toMatchTypeOf<Expected>();
  });

  const withDecorator: Decorator<{ decoratorArg: number }> = (Story, { args }) => h(Story, null);

  it('Correct args are inferred when type is widened for decorators', () => {
    type Props = ButtonProps & { decoratorArg: number };

    const meta = satisfies<Meta<Props>>()({
      component: Button,
      args: { disabled: false },
      decorators: [withDecorator],
    });

    const Basic: StoryObj<typeof meta> = { args: { decoratorArg: 0, label: 'good' } };

    type Expected = PreactStory<Props, SetOptional<Props, 'disabled'>>;
    expectTypeOf(Basic).toEqualTypeOf<Expected>();
  });
});
