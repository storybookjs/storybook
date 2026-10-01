// this file primarily tests TypeScript types with some runtime assertions
import { describe, expect, expectTypeOf, it, test } from 'vitest';

import type { Args } from 'storybook/internal/types';

import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { fn, mocked } from 'storybook/test';

import { __definePreview } from './preview.ts';
import type { Decorator } from './public-types.ts';

type ButtonProps = { label: string; disabled: boolean };

class MyButton extends LitElement {
  disabled!: boolean;
  label!: string;

  render() {
    return html`<button>${this.label}</button>`;
  }
}

class MyComponent extends LitElement {
  render() {
    return html`
      <button></button>
    `;
  }
}

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

class MyCard extends LitElement {
  variant!: 'primary' | 'secondary';
  size!: Size;
  icon!: `icon-${string}`;
  userId!: UserId;
  range!: [min: number, max: number];
  items!: string[];
  config!: { theme: { mode: 'light' | 'dark'; accents: { tone: 'warm' | 'cool' }[] } };
  shape!: Shape;
  store!: Store;
  onChange!: (value: number) => void;
  handlers!: { onSelect: (item: string) => void; onReset: () => void };
  getUsers!: () => Promise<string[]>;
}

class ExampleButton extends LitElement {
  primary?: boolean;
  backgroundColor?: string;
  size?: 'small' | 'medium' | 'large';
  label!: string;
  onClick?: (event: MouseEvent) => void;
}

declare global {
  interface HTMLElementTagNameMap {
    'example-button': ExampleButton;
    'my-button': MyButton;
    'my-component': MyComponent;
    'my-card': MyCard;
  }
}

const preview = __definePreview({
  addons: [],
});

test('csf factories', () => {
  const meta = preview.meta({
    component: 'my-button',
    args: { label: '1' },
  });

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
      component: 'my-button',
      args: { label: 'good', disabled: false },
    });

    const Basic = meta.story({});
  });

  it('✅ Required args may be provided partial in meta and the story', () => {
    const meta = preview.meta({
      component: 'my-button',
      args: { label: 'good' },
    });
    const Basic = meta.story({
      args: { disabled: false },
    });
  });

  it('❌ The combined shape of meta args and story args must match the required args.', () => {
    {
      const meta = preview.type<{ args: ButtonProps }>().meta({ component: 'my-button' });
      // @ts-expect-error disabled not provided ❌
      const Basic = meta.story({
        args: { label: 'good' },
      });
    }
    {
      const meta = preview.type<{ args: ButtonProps }>().meta({
        component: 'my-button',
        args: { label: 'good' },
      });
      // @ts-expect-error disabled not provided ❌
      const Basic = meta.story();
    }
    {
      const meta = preview.type<{ args: ButtonProps }>().meta({ component: 'my-button' });
      // @ts-expect-error disabled not provided ❌
      const Basic = meta.story({
        args: { label: 'good' },
      });
    }
  });

  it("✅ Required args don't need to be provided when the user uses an empty render", () => {
    const meta = preview.meta({
      component: 'my-button',
      args: { label: 'good' },
    });
    const Basic = meta.story({
      render: () =>
        html`
          <div>Hello world</div>
        `,
    });

    const CSF1 = meta.story(
      () =>
        html`
          <div>Hello world</div>
        `
    );
  });

  it('❌ Required args need to be provided when the user uses a non-empty render', () => {
    const meta = preview.type<{ args: ButtonProps }>().meta({
      component: 'my-button',
      args: { label: 'good' },
    });
    // @ts-expect-error disabled not provided ❌
    const Basic = meta.story({
      args: {
        label: 'good',
      },
      render: (args) =>
        html`
          <div>Hello world</div>
        `,
    });
  });
});

type ThemeData = 'light' | 'dark';

describe('Story args can be inferred', () => {
  it('Correct args are inferred when type is widened for render function', () => {
    const meta = preview.type<{ args: { theme: ThemeData } }>().meta({
      component: 'my-button',
      args: { disabled: false },
      render: (args) => {
        return html`<div class="theme-${args.theme}">
          <my-button .label=${args.label} .disabled=${args.disabled}></my-button>
        </div>`;
      },
    });

    const Basic = meta.story({ args: { theme: 'light', label: 'good' } });
  });

  it('Args of a typed render can be set in meta', () => {
    const meta = preview.meta({
      component: 'my-button',
      render: (args: { label: string; theme: ThemeData }) =>
        html`<my-button class="theme-${args.theme}" .label=${args.label}></my-button>`,
      args: { theme: 'light', disabled: false },
    });

    const Basic = meta.story({ args: { label: 'good' } });
  });

  const withDecorator: Decorator<{ decoratorArg: number }> = (Story, { args }) => html`
    <div>Decorator: ${args.decoratorArg} ${Story()}</div>
  `;

  it('Correct args are inferred when type is widened for decorators', () => {
    const meta = preview.meta({
      component: 'my-button',
      args: { disabled: false },
      decorators: [withDecorator],
    });

    const Basic = meta.story({ args: { decoratorArg: 0, label: 'good' } });
  });

  it('Correct args are inferred when type is widened for multiple decorators', () => {
    const secondDecorator: Decorator<{ decoratorArg2: string }> = (Story, { args }) => html`
      <div>Decorator: ${args.decoratorArg2} ${Story()}</div>
    `;

    // decorator is not using args
    const thirdDecorator: Decorator<Args> = (Story) => html` <div>${Story()}</div> `;

    // decorator is not using args
    const fourthDecorator: Decorator = (Story) => html` <div>${Story()}</div> `;

    const meta = preview.meta({
      component: 'my-button',
      args: { disabled: false },
      decorators: [withDecorator, secondDecorator, thirdDecorator, fourthDecorator],
    });

    const Basic = meta.story({
      args: { decoratorArg: 0, decoratorArg2: '', label: 'good' },
    });
  });

  it('args can be reused', () => {
    const meta = preview.meta({
      component: 'my-button',
    });

    const Enabled = meta.story({ args: { label: 'hello', disabled: false } });
    const Disabled = meta.story({ args: { ...Enabled.input.args, disabled: true } });
  });

  it('stories can be extended', () => {
    const meta = preview.meta({
      component: 'my-button',
    });

    const Enabled = meta.story({ args: { label: 'hello', disabled: false } });
    const Disabled = Enabled.extend({ args: { disabled: true } });
  });
});

it('Components without Props can be used', () => {
  const withDecorator: Decorator = (Story) => html` <div>${Story()}</div> `;

  const meta = preview.meta({
    component: 'my-component',
    decorators: [withDecorator],
  });

  const Basic = meta.story();
});

// https://github.com/storybookjs/storybook/issues/33524
it('✅ Kebab-case HTML attribute names are allowed in args', () => {
  const meta = preview.meta({
    component: 'my-button',
    args: {
      label: 'hello',
      'aria-label': 'my button', // kebab-case attribute
    },
  });

  const Basic = meta.story({
    args: {
      'data-testid': 'button-1', // kebab-case attribute
    },
  });

  expect(meta.input.args?.['aria-label']).toBe('my button');
  expect(Basic.input.args?.['data-testid']).toBe('button-1');
});

describe('Custom args types written by the csf-factories codemod', () => {
  it('✅ No arg of a custom args type is required next to a component', () => {
    const meta = preview
      .type<{ args: Partial<ButtonProps & { footer: string }> }>()
      .meta({ component: 'my-button' });

    const Default = meta.story();
    const CustomFooter = meta.story({
      args: { label: 'good', footer: 'good' },
      render: ({ footer }) => html`<my-button></my-button>${footer}`,
    });
  });

  it('✅ The element class can be the custom args type', () => {
    const meta = preview.type<{ args: Partial<MyButton> }>().meta({ component: 'my-button' });

    const Default = meta.story();
    const Labelled = meta.story({ args: { label: 'good' } });
  });

  it('✅ A custom args type is used by the render of a meta without component', () => {
    const Button = ({ label }: ButtonProps) => html`<button>${label}</button>`;

    const meta = preview.type<{ args: ButtonProps }>().meta({
      render: (args) => Button(args),
      args: { disabled: false },
    });

    const Labelled = meta.story({ args: { label: 'good' } });
    // @ts-expect-error label not provided ❌
    const Default = meta.story();
  });

  it('❌ An element class that is carried over as it is requires every member of that class', () => {
    const meta = preview.type<{ args: MyButton }>().meta({ component: 'my-button' });

    // @ts-expect-error disabled and every member of LitElement not provided ❌
    const Labelled = meta.story({ args: { label: 'good' } });
  });
});

describe('Meta args are typed by the keys you provide', () => {
  const meta = preview.type<{ args: { label: string } }>().meta({
    component: 'my-card',
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
      onChange: (value) => expectTypeOf(value).toEqualTypeOf<number>(),
      handlers: {
        onSelect: (item) => expectTypeOf(item).toEqualTypeOf<string>(),
        onReset: function () {},
      },
      getUsers: fn(),
      'aria-label': 'Card',
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
    preview.meta({ component: 'my-card', args: { variant: 'tertiary' } });
    // @ts-expect-error not a shape kind
    preview.meta({ component: 'my-card', args: { shape: { kind: 'oval', radius: 1 } } });
    // @ts-expect-error max must be a number
    preview.meta({ component: 'my-card', args: { range: [0, 'ten'] } });
    // @ts-expect-error not a property of my-card
    preview.meta({ component: 'my-card', args: { variant: 'primary', unknown: true } });
  });

  it('stories override meta args and infer callback parameters', () => {
    const Default = meta.story({
      args: {
        label: 'Hi',
        variant: 'secondary',
        onclick: () => {},
        handlers: {
          onSelect: (item) => expectTypeOf(item).toEqualTypeOf<string>(),
          onReset: () => undefined,
        },
      },
    });
    const Extended = Default.extend({ args: { variant: 'primary', onclick: function () {} } });
    // @ts-expect-error not a variant
    Default.extend({ args: { variant: 'tertiary' } });
  });

  it('meta.story() needs no args when meta provides all required args', () => {
    const complete = preview.type<{ args: ButtonProps }>().meta({
      component: 'my-button',
      args: { label: 'Hi', disabled: false },
    });
    const Default = complete.story();
  });

  it('union props accept keys shared by every member', () => {
    type Props = { label: string } & (
      | { kind: 'link'; href: string }
      | { kind: 'button'; onPress: () => void }
    );
    const render = (args: Props) => html`<a>${args.label}</a>`;

    const actionMeta = preview.meta({ render, args: { label: 'Go', kind: 'link' } });
    const Link = actionMeta.story({ args: { href: '/' } });

    // @ts-expect-error href is not a prop of every member, set it per story
    preview.meta({ render, args: { kind: 'link', href: '/' } });
  });

  it('args declared with preview.type<>() and decorators', () => {
    const withTheme: Decorator<{ theme: 'light' | 'dark' }> = (Story) => Story();

    const typedMeta = preview.type<{ args: { locale: 'en' | 'nl' } }>().meta({
      component: 'my-button',
      decorators: [withTheme],
      args: { locale: 'nl', theme: 'dark', label: 'Hi' },
    });
    const Default = typedMeta.story({ args: { disabled: false } });
    expectTypeOf(typedMeta.input.args.locale).toEqualTypeOf<'en' | 'nl'>();
  });

  it('render-only meta', () => {
    const renderMeta = preview.meta({
      render: (args: { mode: 'compact' | 'wide'; count: number }) => html`${args.count}`,
      args: { mode: 'wide' },
    });
    const Default = renderMeta.story({ args: { count: 1 } });
    // @ts-expect-error count is required
    const Missing = renderMeta.story();
  });

  it('meta without component or render accepts any args', () => {
    const titleMeta = preview.meta({ title: 'Card', args: { count: 1 } });
    const Default = titleMeta.story({ args: { count: 'many' } });
  });
});

it('a meta like the Button stories of the sandboxes', () => {
  const meta = preview.meta({
    title: 'Example/Button',
    component: 'example-button',
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
    render: (args) => html`<my-button .label=${args.label}></my-button>`,
    argTypes: { size: { control: 'select', options: ['small', 'large'] } },
    args: { onClick: fn() },
  });

  const Default = meta.story({ args: { label: 'Hi' } });
});

it('a render typed as any keeps the component args', () => {
  const meta = preview.meta({
    component: 'my-button',
    render: (args: any) => html`<my-button .label=${args.label}></my-button>`,
  });
  // @ts-expect-error not a boolean
  const Invalid = meta.story({ args: { disabled: 'yes', label: 'Hi' } });

  // @ts-expect-error bogus is not an arg
  preview.meta({ component: 'my-button', render: (args: any) => html``, args: { bogus: 1 } });
});

describe('meta.type<>() types the stories created from it', () => {
  const meta = preview.meta({ component: 'my-button', args: { disabled: false } });

  it('adds an arg to the args and the render of that story only', () => {
    meta.type<{ args: { icon: 'star' | 'heart' } }>().story({
      args: { label: 'Hi', icon: 'star' },
      render: (args) => {
        expectTypeOf(args.icon).toEqualTypeOf<'star' | 'heart'>();
        expectTypeOf(args.label).toEqualTypeOf<string | undefined>();
        return html`
          <my-button></my-button>
        `;
      },
      play: async ({ args }) => {
        expectTypeOf(args.icon).toEqualTypeOf<'star' | 'heart'>();
      },
    });

    meta.story({
      // @ts-expect-error icon is not an arg of the other stories
      render: ({ icon }) =>
        html`
          <my-button></my-button>
        `,
    });
    // @ts-expect-error icon must be 'star' | 'heart'
    meta.type<{ args: { icon: 'star' | 'heart' } }>().story({ args: { icon: 'x' } });
  });

  it('a required key is required in that story only, next to the optional component args', () => {
    const typed = meta.type<{ args: { icon: string } }>();
    typed.story({ args: { icon: 'star' } });
    typed.story({ args: { icon: 'star', label: 'Hi', disabled: true } });
    // @ts-expect-error icon is required
    typed.story({ args: { label: 'Hi' } });
    // @ts-expect-error icon is required
    typed.story();
    meta.type<{ args: { icon?: string } }>().story();
    meta.story();
  });

  it('a story with a render that takes no args needs no args', () => {
    const typed = meta.type<{ args: { icon: string } }>();
    typed.story(
      () =>
        html`
          <my-button></my-button>
        `
    );
    typed.story({
      render: () =>
        html`
          <my-button></my-button>
        `,
    });
  });

  it('composes with preview.type<>(), decorators and itself', () => {
    const withTheme: Decorator<{ theme: 'light' | 'dark' }> = (Story) => Story();
    const typedMeta = preview.type<{ args: { locale: 'en' | 'nl' } }>().meta({
      component: 'my-button',
      decorators: [withTheme],
      args: { locale: 'nl' },
    });
    const typed = typedMeta.type<{ args: { icon: string } }>().type<{ args: { size: number } }>();

    typed.story({
      args: { theme: 'dark', icon: 'star', size: 1 },
      play: async ({ args }) => {
        expectTypeOf(args.locale).toEqualTypeOf<'en' | 'nl'>();
        expectTypeOf(args.theme).toEqualTypeOf<'light' | 'dark'>();
        expectTypeOf(args.icon).toEqualTypeOf<string>();
        expectTypeOf(args.size).toEqualTypeOf<number>();
      },
    });
    // @ts-expect-error size is required
    typed.story({ args: { theme: 'dark', icon: 'star' } });
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
