// this file tests Typescript types that's why there are no assertions
import { describe, expect, expectTypeOf, it, test } from 'vitest';

import type { Canvas, ComponentAnnotations, StoryAnnotations } from 'storybook/internal/types';

import { h } from 'vue';

import BaseLayout from './__tests__/BaseLayout.vue';
import Button from './__tests__/Button.vue';
import Decorator2TsVue from './__tests__/Decorator2.vue';
import DecoratorTsVue from './__tests__/Decorator.vue';
import { __definePreview } from './preview';
import type { ComponentPropsAndSlots, Decorator, Meta, StoryObj } from './public-types';

type ButtonProps = ComponentPropsAndSlots<typeof Button>;

const preview = __definePreview({
  addons: [],
});

test('csf factories', () => {
  const config = __definePreview({
    addons: [
      {
        decorators: [],
      },
    ],
  });

  const meta = config.meta({ component: Button, args: { disabled: false } });

  const MyStory = meta.story({
    args: {
      label: 'Hello world',
    },
  });

  expect(MyStory.input.args?.label).toBe('Hello world');
});

describe('Meta', () => {
  it('Generic parameter of Meta can be a component', () => {
    const meta = preview.meta({
      component: Button,
      args: { label: 'good', disabled: false },
    });
  });

  it('Events are inferred from component', () => {
    const meta = preview.meta({
      component: Button,
      args: {
        label: 'good',
        disabled: false,
        onMyChangeEvent: (value) => {
          expectTypeOf(value).toMatchTypeOf<number>();
        },
      },
      render: (args) => {
        return h(Button, {
          ...args,
          onMyChangeEvent: (value) => {
            expectTypeOf(value).toMatchTypeOf<number>();
          },
        });
      },
    });
  });
});

describe('StoryObj', () => {
  it('✅ Required args may be provided partial in meta and the story', () => {
    const meta = preview.meta({
      component: Button,
      args: { label: 'good' },
    });

    const Story = meta.story({
      args: {
        disabled: true,
      },
    });
  });

  it('❌ The combined shape of meta args and story args must match the required args.', () => {
    {
      const meta = preview.meta({
        component: Button,
        args: { label: 'good' },
      });
      // @ts-expect-error disabled not provided ❌
      const Basic = meta.story();
    }
    {
      const meta = preview.meta({ component: Button });
      // @ts-expect-error disabled not provided ❌
      const Basic = meta.story({
        args: { label: 'good' },
      });
    }
  });
});

type ThemeData = 'light' | 'dark';

describe('Story args can be inferred', () => {
  it('Correct args are inferred when type is widened for render function', () => {
    const meta = preview.type<{ args: { theme: ThemeData } }>().meta({
      component: Button,
      render: (args) => {
        return h('div', [h('div', `Use the theme ${args.theme}`), h(Button, args)]);
      },
      args: { disabled: false },
    });

    const Basic = meta.story({ args: { theme: 'light', label: 'good' } });
  });

  const withDecorator: Decorator<{ decoratorArg: string }> = (
    storyFn,
    { args: { decoratorArg } }
  ) => h(DecoratorTsVue, { decoratorArg }, h(storyFn()));

  it('Correct args are inferred when type is widened for decorators', () => {
    type Props = ButtonProps & { decoratorArg: string };

    const meta = preview.meta({
      component: Button,
      args: { disabled: false },
      decorators: [withDecorator],
    });

    const Basic = meta.story({ args: { decoratorArg: 'title', label: 'good' } });
  });

  it('Correct args are inferred when type is widened for multiple decorators', () => {
    type Props = ButtonProps & {
      decoratorArg: string;
      decoratorArg2: string;
    };

    const secondDecorator: Decorator<{ decoratorArg2: string }> = (
      storyFn,
      { args: { decoratorArg2 } }
    ) => h(Decorator2TsVue, { decoratorArg2 }, h(storyFn()));

    const meta = preview.meta({
      component: Button,
      args: { disabled: false },
      decorators: [withDecorator, secondDecorator],
    });

    const Basic = meta.story({
      args: { decoratorArg: '', decoratorArg2: '', label: 'good' },
    });
  });
});

it('Infer type of slots', () => {
  const meta = preview.meta({
    component: BaseLayout,
  });

  const Basic = meta.story({
    args: {
      otherProp: true,
      header: ({ title }) =>
        h({
          components: { Button },
          template: `<Button :primary='true' label='${title}'></Button>`,
        }),
      default: 'default slot',
      footer: h(Button, { disabled: true, label: 'footer' }),
    },
  });
});

it('mount accepts a Component', () => {
  const Basic: StoryObj<typeof Button> = {
    async play({ mount }) {
      const canvas = await mount(Button, { props: { label: 'label', disabled: true } });
      expectTypeOf(canvas).toMatchTypeOf<Canvas>();
    },
  };
});

it('allow types to be inferred from render as well', () => {
  const meta = preview.meta({
    render: (args: ButtonProps) => ({
      data: () => ({ args }),
      template: `<Button v-bind="args" />`,
    }),
    args: { label: 'hello' },
  });

  const Story = meta.story({
    args: { disabled: true },
  });
});
