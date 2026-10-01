// @vitest-environment happy-dom
// this file tests Typescript types that's why there are no assertions
import { describe, it } from 'vitest';
import { expect, test } from 'vitest';

import type {
  ButtonHTMLAttributes,
  ComponentType,
  KeyboardEventHandler,
  MouseEvent,
  ReactElement,
  ReactNode,
} from 'react';
import React from 'react';

import type { Canvas } from 'storybook/internal/csf';
import type { Args, StrictArgs } from 'storybook/internal/types';

import { expectTypeOf } from 'expect-type';
import { fn, mocked } from 'storybook/test';
import type { Mock } from 'storybook/test';

import { __definePreview } from './preview.tsx';
import type { Decorator } from './public-types.ts';

type ButtonProps = { label: string; disabled: boolean; onKeyDown?: () => void };
const Button: (props: ButtonProps) => ReactElement = () => <></>;

const preview = __definePreview({
  addons: [],
});

test('csf factories', () => {
  const meta = preview.meta({ component: Button, args: { disabled: true } });

  const MyStory = meta.story({
    args: {
      label: 'Hello world',
    },
  });

  expect(MyStory.input.args?.label).toBe('Hello world');
});

describe('Args can be provided in multiple ways', () => {
  it('✅ All required args may be provided in meta', () => {
    const meta = preview.meta({
      component: Button,
      args: { label: 'good', disabled: false },
    });

    const Basic = meta.story({});
  });

  it('✅ Required args may be provided partial in meta and the story', () => {
    const meta = preview.meta({
      component: Button,
      args: { label: 'good' },
    });
    const Basic = meta.story({
      args: { disabled: false },
    });
  });

  it('❌ The combined shape of meta args and story args must match the required args.', () => {
    {
      const meta = preview.meta({ component: Button });
      // @ts-expect-error disabled not provided ❌
      const Basic = meta.story({
        args: { label: 'good' },
      });
    }
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

  it("✅ Required args don't need to be provided when the user uses an empty render", () => {
    const meta = preview.meta({
      component: Button,
      args: { label: 'good' },
    });
    const Basic = meta.story({
      render: () => <div>Hello world</div>,
    });

    const CSF1 = meta.story(() => <div>Hello world</div>);
  });

  it('❌ Required args need to be provided when the user uses a non-empty render', () => {
    const meta = preview.meta({
      component: Button,
      args: { label: 'good' },
    });
    // @ts-expect-error disabled not provided ❌
    const Basic = meta.story({
      args: {
        label: 'good',
      },
      render: (args) => <div>Hello world</div>,
    });
  });
});

it('✅ Void functions are not changed', () => {
  interface CmpProps {
    label: string;
    disabled: boolean;
    onClick(): void;
    onKeyDown: KeyboardEventHandler;
    onLoading: (s: string) => ReactElement;
    submitAction(): void;
  }

  const Cmp: (props: CmpProps) => ReactElement = () => <></>;

  const meta = preview.meta({
    component: Cmp,
    args: { label: 'good' },
  });

  const Basic = meta.story({
    args: {
      disabled: false,
      onLoading: () => <div>Loading...</div>,
      onKeyDown: fn(),
      onClick: fn(),
      submitAction: fn(),
    },
  });
});

type ThemeData = 'light' | 'dark';
declare const Theme: (props: { theme: ThemeData; children?: ReactNode }) => ReactElement;

describe('Story args can be inferred', () => {
  it('Correct args are inferred when type is widened for render function', () => {
    const meta = preview.meta({
      component: Button,
      args: { disabled: false },
      render: (args: ButtonProps & { theme: ThemeData }, { component }) => {
        // component is not null as it is provided in meta

        const Component = component!;
        return (
          <Theme theme={args.theme}>
            <Component {...args} />
          </Theme>
        );
      },
    });

    const Basic = meta.story({ args: { theme: 'light', label: 'good' } });
  });

  const withDecorator: Decorator<{ decoratorArg: number }> = (Story, { args }) => (
    <>
      Decorator: {args.decoratorArg}
      <Story args={{ decoratorArg: 0 }} />
    </>
  );

  it('Correct args are inferred when type is widened for decorators', () => {
    const meta = preview.meta({
      component: Button,
      args: { disabled: false },
      decorators: [withDecorator],
    });

    const Basic = meta.story({ args: { decoratorArg: 0, label: 'good' } });
  });

  it('Correct args are inferred when type is widened for multiple decorators', () => {
    type Props = ButtonProps & { decoratorArg: number; decoratorArg2: string };

    const secondDecorator: Decorator<{ decoratorArg2: string }> = (Story, { args }) => (
      <>
        Decorator: {args.decoratorArg2}
        <Story />
      </>
    );

    // decorator is not using args
    const thirdDecorator: Decorator<Args> = (Story) => (
      <>
        <Story />
      </>
    );

    // decorator is not using args
    const fourthDecorator: Decorator<StrictArgs> = (Story) => (
      <>
        <Story />
      </>
    );

    const meta = preview.meta({
      component: Button,
      args: { disabled: false },
      decorators: [withDecorator, secondDecorator, thirdDecorator, fourthDecorator],
    });

    const Basic = meta.story({
      args: { decoratorArg: 0, decoratorArg2: '', label: 'good' },
    });
  });

  it('Component type can be overridden', () => {
    const meta = preview.meta({
      component: Button as unknown as ComponentType<
        Omit<ButtonProps, 'onKeyDown'> & { onKeyDown?: boolean }
      >,
      render: ({ onKeyDown, ...args }) => {
        return <Button {...args} onKeyDown={onKeyDown ? () => {} : undefined} />;
      },
      args: { label: 'hello', onKeyDown: false },
    });

    const Basic = meta.story({
      args: {
        disabled: false,
      },
    });
    const WithKeyDown = meta.story({ args: { disabled: false, onKeyDown: true } });
  });

  it('Correct args are inferred when type is added in renderer', () => {
    const meta = preview.meta({
      component: Button,
      args: { label: 'hello', onKeyDownToggle: false },
      render: ({ onKeyDownToggle, ...args }: ButtonProps & { onKeyDownToggle?: boolean }) => {
        return <Button {...args} onKeyDown={onKeyDownToggle ? () => {} : undefined} />;
      },
    });

    const Basic = meta.story({ args: { disabled: false } });
    const WithKeyDown = meta.story({ args: { disabled: false, onKeyDownToggle: true } });
  });

  it('args can be reused', () => {
    const meta = preview.meta({
      component: Button,
    });

    const Enabled = meta.story({ args: { label: 'hello', disabled: false } });
    const Disabled = meta.story({ args: { ...Enabled.input.args, disabled: true } });
  });

  it('stories can be extended', () => {
    const meta = preview.meta({
      component: Button,
    });

    const Enabled = meta.story({ args: { label: 'hello', disabled: false } });
    const Disabled = Enabled.extend({ args: { disabled: true } });
  });
});

describe('Custom args types written by the csf-factories codemod', () => {
  type Icon = { name: string };
  type StoryArgs = { pageIcon: Icon };

  it('✅ A custom arg can be set in meta and used in a story', () => {
    const meta = preview.type<{ args: StoryArgs }>().meta({
      component: Button,
      args: { pageIcon: { name: 'organization' } },
    });

    const Default = meta.story({
      args: { label: 'good', disabled: false },
      render: ({ pageIcon, ...args }) => (
        <>
          {pageIcon.name}
          <Button {...args} />
        </>
      ),
    });
    const Overridden = meta.story({
      args: { label: 'good', disabled: false, pageIcon: { name: 'user' } },
    });
  });

  it('✅ A custom args type can include the props of the component', () => {
    type ButtonPropsAndCustomArgs = React.ComponentProps<typeof Button> & { footer?: string };
    const meta = preview.type<{ args: ButtonPropsAndCustomArgs }>().meta({ component: Button });

    const Default = meta.story({ args: { label: 'good', disabled: false, footer: 'footer' } });
    // @ts-expect-error disabled not provided ❌
    const Missing = meta.story({ args: { label: 'good' } });
  });

  it('✅ A custom args type that comes from one story is optional for the other stories', () => {
    const meta = preview.type<{ args: Partial<StoryArgs> }>().meta({ component: Button });

    const Default = meta.story({ args: { label: 'good', disabled: false } });
    const WithIcon = meta.story({
      args: { label: 'good', disabled: false, pageIcon: { name: 'user' } },
      render: ({ pageIcon, ...args }) => (
        <>
          {pageIcon?.name}
          <Button {...args} />
        </>
      ),
    });
  });

  it('✅ A custom arg can be used when meta has no component', () => {
    const meta = preview.type<{ args: StoryArgs }>().meta({
      render: (args) => <>{args.pageIcon.name}</>,
      args: { pageIcon: { name: 'organization' } },
    });

    const Default = meta.story();
    const Overridden = meta.story({ args: { pageIcon: { name: 'user' } } });
  });
});

it('Components without Props can be used, issue #21768', () => {
  const Component = () => <>Foo</>;
  const withDecorator: Decorator = (Story) => (
    <>
      <Story />
    </>
  );

  const meta = preview.meta({
    component: Component,
    decorators: [withDecorator],
  });

  const Basic = meta.story({});
});

it('Meta is broken when using discriminating types, issue #23629', () => {
  type TestButtonProps = {
    text: string;
  } & (
    | {
        id?: string;
        onClick?: (e: unknown, id: string | undefined) => void;
      }
    | {
        id: string;
        onClick: (e: unknown, id: string) => void;
      }
  );
  const TestButton: React.FC<TestButtonProps> = ({ text }) => {
    return <p>{text}</p>;
  };

  preview.meta({
    title: 'Components/Button',
    component: TestButton,
    args: {
      text: 'Button',
    },
  });
});

it('Args in play are typed as the component declares them, mocked() gives the mock API', () => {
  type Props = {
    label: string;
    onClick: () => void;
    onRender: () => JSX.Element;
    getUsers: () => Promise<string[]>;
  };
  const TestButton = (props: Props) => <></>;

  const meta = preview.meta({
    component: TestButton,
    args: { label: 'label', onClick: fn(), onRender: () => <>some jsx</>, getUsers: fn() },
  });

  const Basic = meta.story({
    play: async ({ args, mount }) => {
      const canvas = await mount(<TestButton {...args} />);
      expectTypeOf(canvas).toEqualTypeOf<Canvas>();
      expectTypeOf(args.onClick).toEqualTypeOf<() => void>();
      expectTypeOf(args.onRender).toEqualTypeOf<() => JSX.Element>();
      mocked(args.getUsers).mockResolvedValue(['Ada']);
      expect(args.onClick).toHaveBeenCalled();
    },
  });
});

describe('Composed getters', () => {
  type Props = {
    label: string;
    onClick: () => void;
    onRender: () => JSX.Element;
  };
  const TestButton = (props: Props) => <></>;

  const meta = preview.meta({
    component: TestButton,
    args: { label: 'label', onClick: fn(), onRender: () => <>some jsx</> },
  });

  it('Composes the play function', async () => {
    const spy = fn();
    const Basic = meta.story({
      play: async ({ args }: { args: Props }) => {
        spy(args);
      },
    });

    await Basic.play({ args: meta.input.args });

    expect(spy).toHaveBeenCalledWith({
      label: 'label',
      onClick: expect.any(Function),
      onRender: expect.any(Function),
    });
  });

  it('Composes the run function', async () => {
    const playSpy = fn();
    const renderSpy = fn();
    const Basic = meta.story({
      play: async ({ args }) => {
        playSpy(args);
      },
      render: () => {
        renderSpy();
        return <></>;
      },
    });

    await Basic.run();

    expect(playSpy).toHaveBeenCalledWith({
      label: 'label',
      onClick: expect.any(Function),
      onRender: expect.any(Function),
    });

    expect(renderSpy).toHaveBeenCalled();
  });
});

it('meta.input also contains play', () => {
  const meta = preview.meta({
    /** Title, component, etc... */
    play: async ({ canvas }) => {
      /** Do some common interactions */
    },
  });

  const ExtendedInteractionsStory = meta.story({
    play: async ({ canvas, ...rest }) => {
      await meta.input.play?.({ canvas, ...rest });

      /** Do some extra interactions */
    },
  });
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
  };
  const Card = (props: CardProps) => <></>;

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
    type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant: 'solid' | 'ghost' };
    const HtmlButton = (props: Props) => <button {...props} />;

    const htmlMeta = preview.meta({
      component: HtmlButton,
      args: {
        variant: 'ghost',
        type: 'submit',
        'aria-label': 'Save',
        onClick: (event) => expectTypeOf(event).toEqualTypeOf<MouseEvent<HTMLButtonElement>>(),
      },
    });
    const Default = htmlMeta.story();
  });

  it('generic components', () => {
    function List<T>(props: { items: T[]; onPick: (item: T) => void }) {
      return <></>;
    }
    const listMeta = preview.meta({ component: List, args: { items: ['a'] } });
    const Default = listMeta.story({ args: { onPick: () => {} } });
  });

  it('union props accept keys shared by every member', () => {
    type Props = { label: string } & (
      | { kind: 'link'; href: string }
      | { kind: 'button'; onClick: () => void }
    );
    const Action = (props: Props) => <></>;

    const actionMeta = preview.meta({ component: Action, args: { label: 'Go', kind: 'link' } });
    const Link = actionMeta.story({ args: { href: '/' } });

    preview.meta({
      component: Action,
      // @ts-expect-error href is not a prop of every member, set it per story
      args: { kind: 'link', href: '/' },
    });
  });

  it('args declared with preview.type<>() and decorators', () => {
    const withTheme: Decorator<{ theme: 'light' | 'dark' }> = (Story) => <Story />;

    const typedMeta = preview.type<{ args: { locale: 'en' | 'nl' } }>().meta({
      component: Button,
      decorators: [withTheme],
      args: { locale: 'nl', theme: 'dark', label: 'Hi' },
      beforeEach: ({ args }) => {
        expectTypeOf(args.locale).toEqualTypeOf<'en' | 'nl'>();
      },
    });
    const Default = typedMeta.story({ args: { disabled: false } });
    expectTypeOf(typedMeta.input.args.locale).toEqualTypeOf<'en' | 'nl'>();
  });

  it('meta without component or render accepts any args', () => {
    const titleMeta = preview.meta({ title: 'Card', args: { count: 1 } });
    const Default = titleMeta.story({ args: { count: 'many' } });
  });

  it('render-only meta', () => {
    const renderMeta = preview.meta({
      render: (args: { mode: 'compact' | 'wide'; count: number }) => <>{args.count}</>,
      args: { mode: 'wide' },
    });
    const Default = renderMeta.story({ args: { count: 1 } });
    // @ts-expect-error count is required
    const Missing = renderMeta.story();
  });

  it('meta args can come from a Partial object, a spread or an Args record', () => {
    const shared: Partial<ButtonProps> = { disabled: false };
    const record: Args = { label: 'Hi' };
    preview.meta({ component: Button, args: shared });
    preview.meta({ component: Button, args: { ...shared, label: 'Hi' } });
    const recordMeta = preview.meta({ component: Button, args: record });
    // @ts-expect-error an Args record doesn't say which args it sets, so label is still required
    recordMeta.story({ args: { disabled: false } });
  });

  it('meta args from a variable or a spread must be args too', () => {
    const shared = { label: 'Hi', extra: 1 };
    // @ts-expect-error extra is not an arg
    preview.meta({ component: Button, args: shared });
    // @ts-expect-error extra is not an arg
    preview.meta({ component: Button, args: { ...shared, disabled: false } });
  });

  it('optional props set in meta are present in its own hooks', () => {
    preview.meta({
      component: Button,
      args: { onKeyDown: fn() },
      beforeEach: ({ args }) => {
        mocked(args.onKeyDown).mockClear();
      },
      loaders: [async ({ args }) => ({ result: args.onKeyDown() })],
    });
  });

  it('stories expose the args of their meta', () => {
    const Default = meta.story({ args: { label: 'Hi' } });
    expectTypeOf(Default.meta.input.args?.label).toEqualTypeOf<string | undefined>();
  });

  it('composes meta and story args at runtime', () => {
    const Default = meta.story({ args: { label: 'Hi', variant: 'secondary' } });

    expect(Default.composed.args).toMatchObject({
      label: 'Hi',
      variant: 'secondary',
      size: Size.Small,
      range: [0, 10],
    });
  });
});

it('a meta like the Button stories of the sandboxes', () => {
  const ExampleButton = (_: {
    primary?: boolean;
    backgroundColor?: string;
    size?: 'small' | 'medium' | 'large';
    label: string;
    onClick?: () => void;
  }) => <button />;

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
  meta.input.args.onClick();

  const Primary = meta.story({
    args: { primary: true, label: 'Button' },
    play: async ({ args }) => {
      expectTypeOf(args.onClick).toEqualTypeOf<() => void>();
      mocked(args.onClick).mockClear();
    },
  });
  const Large = meta.story({ args: { size: 'large', label: 'Button' } });
  // @ts-expect-error not a size
  const Huge = meta.story({ args: { size: 'huge', label: 'Button' } });
});

it('argTypes of a meta without component do not type its args', () => {
  const meta = preview.meta({
    render: (args) => <div>{String(args.label)}</div>,
    argTypes: { size: { control: 'select', options: ['small', 'large'] } },
  });

  const Default = meta.story({ args: { label: 'Hi' } });
});
