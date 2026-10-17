import { describe, expect, expectTypeOf, it, test } from 'vitest';

import type { Canvas } from 'storybook/internal/types';

import type { Component, ComponentProps, Snippet } from 'svelte';

import { fn, mocked } from 'storybook/test';

import Button from './__test__/Button.svelte';
import Decorator2 from './__test__/Decorator2.svelte';
import Decorator1 from './__test__/Decorator.svelte';
import Divider from './__test__/Divider.svelte';
import Input from './__test__/Input.svelte';
import Layout from './__test__/Layout.svelte';
import List from './__test__/List.svelte';
import { __definePreview } from './preview.ts';
import type { Decorator, StoryObj } from './public-types.ts';

type ButtonProps = ComponentProps<typeof Button>;

const preview = __definePreview({ addons: [] });

test('csf factories', () => {
  const config = __definePreview({ addons: [{ decorators: [] }] });

  const meta = config.meta({ component: Button, args: { disabled: false } });
  const MyStory = meta.story({ args: { label: 'Hello world' } });

  expect(MyStory.input.args?.label).toBe('Hello world');
});

describe('Meta', () => {
  it('Generic parameter of Meta can be a component', () => {
    preview.meta({ component: Button, args: { label: 'good', disabled: false } });
  });

  it('Callback props are inferred from the component', () => {
    preview.meta({
      component: Button,
      args: {
        label: 'good',
        disabled: false,
        clicked: (event) => expectTypeOf(event).toEqualTypeOf<MouseEvent>(),
      },
      render: (args) => {
        expectTypeOf(args.clicked).toEqualTypeOf<((e: MouseEvent) => void) | undefined>();
        return { Component: Button, props: args };
      },
    });
  });
});

describe('StoryObj', () => {
  it('✅ Required args may be provided partial in meta and the story', () => {
    const meta = preview.meta({ component: Button, args: { label: 'good' } });
    const Story = meta.story({ args: { disabled: true } });
  });

  it('❌ The combined shape of meta args and story args must match the required args.', () => {
    {
      const meta = preview.meta({ component: Button, args: { label: 'good' } });
      // @ts-expect-error disabled not provided ❌
      const Basic = meta.story();
    }
    {
      const meta = preview.meta({ component: Button });
      // @ts-expect-error disabled not provided ❌
      const Basic = meta.story({ args: { label: 'good' } });
    }
  });

  it('a story with a render that takes no args needs no args', () => {
    const meta = preview.meta({ component: Button });
    const RenderOnly = meta.story(() => ({ Component: Divider }));
    const RenderInObject = meta.story({ render: () => ({ Component: Divider }) });
  });

  it('a story with a render that takes args needs the required args', () => {
    const meta = preview.meta({ component: Button });
    const WithArgs = meta.story({
      args: { label: 'good', disabled: true },
      render: (args) => ({ Component: Button, props: args }),
    });
    // @ts-expect-error disabled not provided ❌
    const Missing = meta.story({
      args: { label: 'good' },
      render: (args) => ({ Component: Button, props: args }),
    });
  });
});

type ThemeData = 'light' | 'dark';

describe('Story args can be inferred', () => {
  it('Correct args are inferred when type is widened for render function', () => {
    const meta = preview.type<{ args: { theme: ThemeData } }>().meta({
      component: Button,
      render: (args) => {
        expectTypeOf(args.theme).toEqualTypeOf<ThemeData>();
        return { Component: Button, props: args };
      },
      args: { disabled: false },
    });

    const Basic = meta.story({ args: { theme: 'light', label: 'good' } });
  });

  it('Args of a typed render can be set in meta', () => {
    const meta = preview.meta({
      component: Button,
      render: (args: ButtonProps & { theme: ThemeData }) => ({ Component: Button, props: args }),
      args: { theme: 'light', disabled: false },
    });

    const Basic = meta.story({ args: { label: 'good' } });
  });

  const withDecorator: Decorator<{ decoratorArg: string }> = (_, { args: { decoratorArg } }) => ({
    Component: Decorator1,
    props: { decoratorArg },
  });

  it('Correct args are inferred when type is widened for decorators', () => {
    const meta = preview.meta({
      component: Button,
      args: { disabled: false },
      decorators: [withDecorator],
    });

    const Basic = meta.story({ args: { decoratorArg: 'title', label: 'good' } });
    // @ts-expect-error decoratorArg not provided ❌
    const Missing = meta.story({ args: { label: 'good' } });
  });

  it('Correct args are inferred when type is widened for multiple decorators', () => {
    const secondDecorator: Decorator<{ decoratorArg2: string }> = (
      _,
      { args: { decoratorArg2 } }
    ) => ({ Component: Decorator2, props: { decoratorArg2 } });

    const meta = preview.meta({
      component: Button,
      args: { disabled: false },
      decorators: [withDecorator, secondDecorator],
    });

    const Basic = meta.story({ args: { decoratorArg: '', decoratorArg2: '', label: 'good' } });
  });
});

describe('Custom args types written by the csf-factories codemod', () => {
  type Icon = { name: string };
  type StoryArgs = { pageIcon: Icon };

  it('✅ A custom args type can include the props of the component', () => {
    const meta = preview
      .type<{ args: ButtonProps & { footer?: string } }>()
      .meta({ component: Button });

    const Default = meta.story({ args: { label: 'good', disabled: false, footer: 'footer' } });
    // @ts-expect-error disabled not provided ❌
    const Missing = meta.story({ args: { label: 'good' } });
  });

  it('✅ A custom arg can be used when meta has no component', () => {
    const PageIcon = {} as Component<StoryArgs>;
    const meta = preview.type<{ args: StoryArgs }>().meta({
      render: (args) => {
        expectTypeOf(args.pageIcon).toEqualTypeOf<Icon>();
        return { Component: PageIcon, props: args };
      },
      args: { pageIcon: { name: 'organization' } },
    });

    const Default = meta.story();
    const Overridden = meta.story({ args: { pageIcon: { name: 'user' } } });
  });
});

describe('Svelte components', () => {
  it('snippet props are args', () => {
    const meta = preview.meta({ component: Layout, args: { title: 'Home' } });

    const Default = meta.story({
      args: {
        children: (() => {}) as unknown as Snippet,
        footer: (() => {}) as unknown as Snippet<[year: number]>,
      },
    });
    // @ts-expect-error children not provided ❌
    const Missing = meta.story();
  });

  it('bindable props are args', () => {
    const meta = preview.meta({
      component: Input,
      args: { oninput: (value) => expectTypeOf(value).toEqualTypeOf<string>() },
    });

    const Default = meta.story({ args: { value: 'Hi' } });
    // @ts-expect-error value must be a string
    const Invalid = meta.story({ args: { value: 1 } });
  });

  it('generic components take their type argument directly', () => {
    const meta = preview.meta({ component: List<{ id: number; name: string }> });

    const Default = meta.story({
      args: {
        items: [{ id: 1, name: 'Ada' }],
        getLabel: (item) => {
          expectTypeOf(item).toEqualTypeOf<{ id: number; name: string }>();
          return item.name;
        },
      },
    });
  });

  it('a component without props needs no args', () => {
    const meta = preview.meta({ component: Divider });
    const Default = meta.story();
  });

  it('mount accepts a component and its props', () => {
    const Basic: StoryObj<typeof Button> = {
      async play({ mount }) {
        const canvas = await mount(Button, { props: { label: 'label', disabled: true } });
        expectTypeOf(canvas).toEqualTypeOf<Canvas>();
      },
    };
  });
});

it('allow types to be inferred from render as well', () => {
  const meta = preview.meta({
    render: (args: ButtonProps) => ({ Component: Button, props: args }),
    args: { label: 'hello' },
  });

  const Story = meta.story({ args: { disabled: true } });
});

it('Literal props need no `as const` in meta args, issue #36125', () => {
  const Badge = {} as Component<{ label: string; variant: 'primary' | 'secondary' }>;

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
    onclick: () => void;
    onchange: (value: number) => void;
    handlers: { onselect: (item: string) => void; onreset: () => void };
    getUsers: () => Promise<string[]>;
  };
  const Card = {} as Component<CardProps>;

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
      onclick: () => {},
      onchange: (value) => expectTypeOf(value).toEqualTypeOf<number>(),
      handlers: {
        onselect: (item) => expectTypeOf(item).toEqualTypeOf<string>(),
        onreset: function () {},
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
        onclick: () => {},
        handlers: {
          onselect: (item) => expectTypeOf(item).toEqualTypeOf<string>(),
          onreset: () => undefined,
        },
      },
    });
    const Extended = Default.extend({ args: { variant: 'primary', onclick: function () {} } });
    // @ts-expect-error not a variant
    Default.extend({ args: { variant: 'tertiary' } });
  });

  it('meta.story() needs no args when meta provides all required args', () => {
    const complete = preview.meta({ component: Button, args: { label: 'Hi', disabled: false } });
    const Default = complete.story();
  });

  it('union props accept keys shared by every member', () => {
    type Props = { label: string } & (
      | { kind: 'link'; href: string }
      | { kind: 'button'; onpress: () => void }
    );
    const Action = {} as Component<Props>;

    const actionMeta = preview.meta({ component: Action, args: { label: 'Go', kind: 'link' } });
    const Link = actionMeta.story({ args: { href: '/' } });

    // @ts-expect-error href is not a prop of every member, set it per story
    preview.meta({ component: Action, args: { kind: 'link', href: '/' } });
  });

  it('args declared with preview.type<>() and decorators', () => {
    const withTheme: Decorator<{ theme: 'light' | 'dark' }> = (Story) => Story();

    const typedMeta = preview.type<{ args: { locale: 'en' | 'nl' } }>().meta({
      component: Button,
      decorators: [withTheme],
      args: { locale: 'nl', theme: 'dark', label: 'Hi' },
    });
    const Default = typedMeta.story({ args: { disabled: false } });
    expectTypeOf(typedMeta.input.args.locale).toEqualTypeOf<'en' | 'nl'>();
  });

  it('render-only meta', () => {
    type CounterProps = { mode: 'compact' | 'wide'; count: number };
    const Counter = {} as Component<CounterProps>;
    const renderMeta = preview.meta({
      render: (args: CounterProps) => ({ Component: Counter, props: args }),
      args: { mode: 'wide' },
    });
    const Default = renderMeta.story({ args: { count: 1 } });
    // @ts-expect-error count is required
    const Missing = renderMeta.story();
  });
});

it('a meta like the Button stories of the sandboxes', () => {
  const ExampleButton = {} as Component<{
    primary?: boolean;
    backgroundColor?: string;
    size?: 'small' | 'medium' | 'large';
    label: string;
    onclick?: (event: MouseEvent) => void;
  }>;

  const meta = preview.meta({
    title: 'Example/Button',
    component: ExampleButton,
    tags: ['autodocs'],
    argTypes: {
      backgroundColor: { control: 'color' },
      size: { control: { type: 'select' }, options: ['small', 'medium', 'large'] },
    },
    args: { onclick: fn() },
  });

  const Primary = meta.story({
    args: { primary: true, label: 'Button' },
    play: async ({ args }) => {
      mocked(args.onclick).mockClear();
    },
  });
  const Large = meta.story({ args: { size: 'large', label: 'Button' } });
  // @ts-expect-error not a size
  const Huge = meta.story({ args: { size: 'huge', label: 'Button' } });
});

it('argTypes of a meta without component do not type its args', () => {
  const Text = {} as Component<Record<string, unknown>>;
  const meta = preview.meta({
    render: (args) => ({ Component: Text, props: args }),
    argTypes: { size: { control: 'select', options: ['small', 'large'] } },
  });

  const Default = meta.story({ args: { label: 'Hi' } });
});

it('components without known props accept any args', () => {
  const shim = {} as Component;
  const component: any = Button;

  preview.meta({ component: shim, args: { label: 'Hi' } });
  preview.meta({ component, args: { label: 'Hi' } });
});

it('a render typed as any keeps the component args', () => {
  const meta = preview.meta({
    component: Button,
    render: (args: any) => ({ Component: Button, props: args }),
  });
  // @ts-expect-error not a boolean
  const Invalid = meta.story({ args: { disabled: 'yes', label: 'Hi' } });

  preview.meta({
    component: Button,
    render: (args: any) => ({ Component: Button, props: args }),
    // @ts-expect-error bogus is not an arg
    args: { bogus: 1 },
  });
});

describe('meta.type<>() types the stories created from it', () => {
  const meta = preview.meta({ component: Button, args: { disabled: false } });

  it('adds an arg to the args and the render of that story only', () => {
    meta.type<{ args: { icon: 'star' | 'heart' } }>().story({
      args: { label: 'Hi', icon: 'star' },
      render: (args) => {
        expectTypeOf(args.icon).toEqualTypeOf<'star' | 'heart'>();
        expectTypeOf(args.label).toEqualTypeOf<string>();
        return { Component: Button, props: args };
      },
      play: async ({ args }) => {
        expectTypeOf(args.icon).toEqualTypeOf<'star' | 'heart'>();
      },
    });

    meta.story({
      args: { label: 'Hi' },
      // @ts-expect-error icon is not an arg of the other stories
      render: ({ icon, ...args }) => ({ Component: Button, props: args }),
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
    complete.type<{ args: { icon: string } }>().story(() => ({ Component: Divider }));
    complete.type<{ args: { icon: string } }>().story({ render: () => ({ Component: Divider }) });
  });

  it('composes with preview.type<>(), decorators and itself', () => {
    const withTheme: Decorator<{ theme: 'light' | 'dark' }> = (Story) => Story();
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
