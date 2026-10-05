// this file tests Typescript types that's why there are no assertions
import { describe, expect, expectTypeOf, it, test } from 'vitest';

import type { Canvas } from 'storybook/internal/types';

import type { DefineComponent, FunctionalComponent, HTMLAttributes } from 'vue';
import { h } from 'vue';

import { fn, mocked } from 'storybook/test';

import Badge from './__tests__/Badge.vue';
import BaseLayout from './__tests__/BaseLayout.vue';
import Button from './__tests__/Button.vue';
import Decorator2TsVue from './__tests__/Decorator2.vue';
import DecoratorTsVue from './__tests__/Decorator.vue';
import GenericComponent from './__tests__/GenericComponent.vue';
import { __definePreview } from './preview.ts';
import type { ComponentPropsAndSlots, Decorator, Meta, StoryObj } from './public-types.ts';

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

  it('Args of a typed render can be set in meta', () => {
    const meta = preview.meta({
      component: Button,
      render: (args: ButtonProps & { theme: ThemeData }) =>
        h('div', [h('div', `Use the theme ${args.theme}`), h(Button, args)]),
      args: { theme: 'light', disabled: false },
    });

    const Basic = meta.story({ args: { label: 'good' } });
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

describe('Generic components (issue #24238)', () => {
  // Generic Vue components with TypeScript generics work with CSF factories
  // by passing the type parameter directly: GenericComponent<ConcreteType>
  // See: https://github.com/storybookjs/storybook/issues/24238

  it('✅ Generic components work by passing type parameter directly', () => {
    const meta = preview.meta({
      component: GenericComponent<{ id: number; name: string }>,
    });

    const Story = meta.story({
      args: {
        items: [
          {
            id: 1,
            name: 'John Doe',
          },
        ],
        getLabel: (item) => {
          // item is correctly typed as { id: number; name: string }
          expectTypeOf(item).toMatchObjectType<{ id: number; name: string }>();
          return item.name;
        },
      },
    });

    // Verify the story has the correct args
    expect(Story.input.args?.items).toHaveLength(1);
  });
});

it('Literal props of an SFC need no `as const` in meta args, issue #36125', () => {
  const meta = preview.meta({ component: Badge, args: { variant: 'primary' } });
  const Default = meta.story({ args: { label: 'Hi' } });
  expectTypeOf(meta.input.args.variant).toEqualTypeOf<'primary' | 'secondary'>();

  const typedMeta = preview
    .type<{ args: { extra?: boolean } }>()
    .meta({ component: Badge, args: { variant: 'primary', label: 'Hi' } });
  const NoArgs = typedMeta.story();
});

describe('Meta args are typed by the keys you provide', () => {
  enum Size {
    Small = 'small',
    Large = 'large',
  }
  type UserId = string & { readonly brand: unique symbol };
  const userId = (id: string) => id as UserId;
  class Store {
    #count = 0;
    increment() {
      this.#count++;
    }
  }
  type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number };
  type CardProps = {
    label: string;
    variant: 'primary' | 'secondary';
    size: Size;
    icon: `icon-${string}`;
    userId: UserId;
    range: [min: number, max: number];
    items: string[];
    config: { theme: { mode: 'light' | 'dark'; accents: { tone: 'warm' | 'cool' }[] } };
    shape: Shape;
    store: Store;
    onClick: () => void;
    onChange: (value: number) => void;
    handlers: { onSelect: (item: string) => void; onReset: () => void };
    getUsers: () => Promise<string[]>;
  };
  const Card: FunctionalComponent<CardProps> = () => h('div');

  const meta = preview.meta({
    component: Card,
    args: {
      variant: 'primary',
      size: Size.Small,
      icon: 'icon-star',
      userId: userId('1'),
      range: [0, 10],
      items: ['a'],
      config: { theme: { mode: 'dark', accents: [{ tone: 'warm' }] } },
      shape: { kind: 'circle', radius: 1 },
      store: new Store(),
      onClick: () => {},
      onChange: (value) => expectTypeOf(value).toEqualTypeOf<number>(),
      handlers: {
        onSelect: (item) => expectTypeOf(item).toEqualTypeOf<string>(),
        onReset: function () {},
      },
      getUsers: fn(),
    },
  });

  it('literal, enum, template literal and branded props need no `as const`', () => {
    expectTypeOf(meta.input.args.variant).toEqualTypeOf<'primary' | 'secondary'>();
    expectTypeOf(meta.input.args.size).toEqualTypeOf<Size>();
    expectTypeOf(meta.input.args.icon).toEqualTypeOf<`icon-${string}`>();
    expectTypeOf(meta.input.args.userId).toEqualTypeOf<UserId>();

    const Default = meta.story({ args: { label: 'Hi' } });
    // @ts-expect-error label is required
    const Missing = meta.story();
  });

  it('meta.input.args keeps the declared prop types', () => {
    const items: string[] = meta.input.args.items;
    expectTypeOf(meta.input.args.range).toEqualTypeOf<[min: number, max: number]>();
    expectTypeOf(meta.input.args.config.theme.accents[0].tone).toEqualTypeOf<'warm' | 'cool'>();
    expectTypeOf(meta.input.args.store).toEqualTypeOf<Store>();

    const { shape } = meta.input.args;
    if (shape.kind === 'circle') {
      expectTypeOf(shape.radius).toEqualTypeOf<number>();
    }
  });

  it('fn() args are typed as declared, mocked() gives the mock API', () => {
    const Default = meta.story({
      args: { label: 'Hi' },
      play: async ({ args }) => {
        expectTypeOf(args.getUsers).toEqualTypeOf<() => Promise<string[]>>();
        mocked(args.getUsers).mockResolvedValue(['Ada']);
      },
    });
  });

  it('invalid meta args are rejected', () => {
    // @ts-expect-error not a variant
    preview.meta({ component: Card, args: { variant: 'tertiary' } });
    // @ts-expect-error not a mode
    preview.meta({ component: Card, args: { config: { theme: { mode: 'dim', accents: [] } } } });
    // @ts-expect-error max must be a number
    preview.meta({ component: Card, args: { range: [0, 'ten'] } });
    // @ts-expect-error not a prop of Card
    preview.meta({ component: Card, args: { variant: 'primary', unknown: true } });
  });

  it('stories override meta args and infer callback parameters', () => {
    const Default = meta.story({
      args: {
        label: 'Hi',
        variant: 'secondary',
        onClick: () => {},
        handlers: {
          onSelect: (item) => expectTypeOf(item).toEqualTypeOf<string>(),
          onReset: () => undefined,
        },
      },
    });
    const Extended = Default.extend({ args: { variant: 'primary', onClick: function () {} } });
    // @ts-expect-error not a variant
    Default.extend({ args: { variant: 'tertiary' } });
  });

  it('meta.story() needs no args when meta provides all required args', () => {
    const complete = preview.meta({
      component: Button,
      args: { label: 'Hi', disabled: false },
    });
    const Default = complete.story();
  });

  it('props with HTML attributes', () => {
    const HtmlButton: FunctionalComponent<HTMLAttributes & { variant: 'solid' | 'ghost' }> = () =>
      h('button');

    const htmlMeta = preview.meta({
      component: HtmlButton,
      args: {
        variant: 'ghost',
        'aria-label': 'Save',
        onClick: (event) => expectTypeOf(event).toMatchTypeOf<MouseEvent>(),
      },
    });
    const Default = htmlMeta.story();
  });

  it('union props accept keys shared by every member', () => {
    type Props = { label: string } & (
      | { kind: 'link'; href: string }
      | { kind: 'button'; onPress: () => void }
    );
    const Action: FunctionalComponent<Props> = () => h('a');

    const actionMeta = preview.meta({ component: Action, args: { label: 'Go', kind: 'link' } });
    const Link = actionMeta.story({ args: { href: '/' } });

    // @ts-expect-error href is not a prop of every member, set it per story
    preview.meta({ component: Action, args: { kind: 'link', href: '/' } });
  });

  it('args declared with preview.type<>() and decorators', () => {
    const withTheme: Decorator<{ theme: 'light' | 'dark' }> = () => ({ template: '<story />' });

    const typedMeta = preview.type<{ args: { locale: 'en' | 'nl' } }>().meta({
      component: Button,
      decorators: [withTheme],
      args: { locale: 'nl', theme: 'dark', label: 'Hi' },
    });
    const Default = typedMeta.story({ args: { disabled: false } });
    expectTypeOf(typedMeta.input.args.locale).toEqualTypeOf<'en' | 'nl'>();
  });

  it('render-only meta', () => {
    const renderMeta = preview.meta({
      render: (args: { mode: 'compact' | 'wide'; count: number }) => ({
        template: `<div>{{ ${args.count} }}</div>`,
      }),
      args: { mode: 'wide' },
    });
    const Default = renderMeta.story({ args: { count: 1 } });
    // @ts-expect-error count is required
    const Missing = renderMeta.story();
  });
});

it('a meta like the Button stories of the sandboxes', () => {
  const ExampleButton: FunctionalComponent<{
    primary?: boolean;
    backgroundColor?: string;
    size?: 'small' | 'medium' | 'large';
    label: string;
    onClick?: (event: MouseEvent) => void;
  }> = () => h('button');

  const meta = preview.meta({
    title: 'Example/Button',
    component: ExampleButton,
    tags: ['autodocs'],
    argTypes: {
      backgroundColor: { control: 'color' },
      size: { control: { type: 'select' }, options: ['small', 'medium', 'large'] },
    },
    args: { onClick: fn() },
  });

  const Primary = meta.story({
    args: { primary: true, label: 'Button' },
    play: async ({ args }) => {
      mocked(args.onClick).mockClear();
    },
  });
  const Large = meta.story({ args: { size: 'large', label: 'Button' } });
  // @ts-expect-error not a size
  const Huge = meta.story({ args: { size: 'huge', label: 'Button' } });
});

it('argTypes of a meta without component do not type its args', () => {
  const meta = preview.meta({
    render: (args) => h('div', String(args.label)),
    argTypes: { size: { control: 'select', options: ['small', 'large'] } },
  });

  const Default = meta.story({ args: { label: 'Hi' } });
});

it('components without known props accept any args', () => {
  const shim = {} as DefineComponent<{}, {}, any>;
  const component: any = Button;

  preview.meta({ component: shim, args: { label: 'Hi' } });
  preview.meta({ component, args: { label: 'Hi' } });
});

it('a render typed as any keeps the component args', () => {
  const meta = preview.meta({ component: Button, render: (args: any) => h(Button, args) });
  // @ts-expect-error not a boolean
  const Invalid = meta.story({ args: { disabled: 'yes', label: 'Hi' } });

  // @ts-expect-error bogus is not an arg
  preview.meta({ component: Button, render: (args: any) => h(Button, args), args: { bogus: 1 } });
});

describe('meta.type<>() types the stories created from it', () => {
  const meta = preview.meta({ component: Button, args: { disabled: false } });

  it('adds an arg to the args and the render of that story only', () => {
    meta.type<{ args: { icon: 'star' | 'heart' } }>().story({
      args: { label: 'Hi', icon: 'star' },
      render: (args) => {
        expectTypeOf(args.icon).toEqualTypeOf<'star' | 'heart'>();
        expectTypeOf(args.label).toEqualTypeOf<string>();
        return { template: '<div />' };
      },
      play: async ({ args }) => {
        expectTypeOf(args.icon).toEqualTypeOf<'star' | 'heart'>();
      },
    });

    meta.story({
      args: { label: 'Hi' },
      // @ts-expect-error icon is not an arg of the other stories
      render: ({ icon }) => ({ template: '<div />' }),
    });
    // @ts-expect-error icon must be 'star' | 'heart'
    meta.type<{ args: { icon: 'star' | 'heart' } }>().story({ args: { label: 'Hi', icon: 'x' } });
  });

  it('a required key is required in that story only', () => {
    // @ts-expect-error icon is required
    meta.type<{ args: { icon: string } }>().story({ args: { label: 'Hi' } });
    meta.type<{ args: { icon?: string } }>().story({ args: { label: 'Hi' } });
    meta.story({ args: { label: 'Hi' } });
  });

  it('args set in meta stay optional and the others stay required', () => {
    const typed = meta.type<{ args: { icon: string } }>();
    typed.story({ args: { label: 'Hi', icon: 'star' } });
    typed.story({ args: { label: 'Hi', icon: 'star', disabled: true } });
    // @ts-expect-error label is required
    typed.story({ args: { icon: 'star' } });
  });

  it('an arg of the meta that is redeclared must be set again', () => {
    // @ts-expect-error disabled is required, the meta sets it to false
    meta.type<{ args: { disabled: true } }>().story({ args: { label: 'Hi' } });
    meta.type<{ args: { disabled: true } }>().story({ args: { label: 'Hi', disabled: true } });
  });

  it('story() needs no args when no required arg is left or render takes none', () => {
    const complete = preview.meta({ component: Button, args: { label: 'Hi', disabled: false } });
    complete.type<{ args: { icon?: string } }>().story();
    complete.type<{ args: { icon?: string } }>().story({});
    // @ts-expect-error icon is required
    complete.type<{ args: { icon: string } }>().story();
    // @ts-expect-error icon is required
    complete.type<{ args: { icon: string } }>().story({});
    complete.type<{ args: { icon: string } }>().story(() => h('div'));
    complete.type<{ args: { icon: string } }>().story({ render: () => h('div') });
  });

  it('composes with preview.type<>(), decorators and itself', () => {
    const withTheme: Decorator<{ theme: 'light' | 'dark' }> = () => ({ template: '<story />' });
    const typedMeta = preview.type<{ args: { locale: 'en' | 'nl' } }>().meta({
      component: Button,
      decorators: [withTheme],
      args: { locale: 'nl', disabled: false },
    });
    const typed = typedMeta.type<{ args: { icon: string } }>().type<{ args: { size: number } }>();

    typed.story({
      args: { label: 'Hi', theme: 'dark', icon: 'star', size: 1 },
      play: async ({ args }) => {
        expectTypeOf(args.locale).toEqualTypeOf<'en' | 'nl'>();
        expectTypeOf(args.theme).toEqualTypeOf<'light' | 'dark'>();
        expectTypeOf(args.icon).toEqualTypeOf<string>();
        expectTypeOf(args.size).toEqualTypeOf<number>();
      },
    });
    // @ts-expect-error size is required
    typed.story({ args: { label: 'Hi', theme: 'dark', icon: 'star' } });
  });

  it('the story can be extended and composed', () => {
    const WithIcon = meta.type<{ args: { icon: string } }>().story({
      args: { label: 'Hi', icon: 'star' },
    });
    const WithHeart = WithIcon.extend({ args: { icon: 'heart' } });
    // @ts-expect-error icon is a string
    WithIcon.extend({ args: { icon: 1 } });

    expectTypeOf(WithIcon.composed.args.icon).toEqualTypeOf<string>();
    expect(WithIcon.composed.args).toEqual({ label: 'Hi', icon: 'star', disabled: false });
    expect(WithHeart.composed.args).toEqual({ label: 'Hi', icon: 'heart', disabled: false });
  });
});
