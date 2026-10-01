// this file primarily tests TypeScript types with some runtime assertions
import { Component, EventEmitter, input, Input, output, Output } from '@angular/core';
import { describe, expect, expectTypeOf, it, test } from 'vitest';

import type { Args } from 'storybook/internal/types';

import { fn, mocked } from 'storybook/test';

import { __definePreview } from './preview.ts';
import type { Decorator } from './public-types.ts';

@Component({
  selector: 'storybook-button',
  standalone: true,
  template: ` <button [disabled]="disabled">{{ label }}</button> `,
})
class ButtonComponent {
  @Input()
  label!: string;

  @Input()
  disabled!: boolean;

  @Output()
  disabledChange = new EventEmitter<void>();
}

type ButtonProps = { label: string; disabled: boolean; disabledChange?: (e: void) => void };

const preview = __definePreview({
  addons: [],
});

test('csf factories', () => {
  const meta = preview.meta({
    component: ButtonComponent,
    args: { disabled: false },
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
      component: ButtonComponent,
      args: { disabled: false },
    });

    const Basic = meta.story({
      args: {},
    });
  });

  it('✅ Required args may be provided partial in meta and the story', () => {
    const meta = preview.type<{ args: ButtonProps }>().meta({
      component: ButtonComponent,
      args: { label: 'good' },
    });
    const Basic = meta.story({
      args: { disabled: false },
    });
  });

  it('❌ The combined shape of meta args and story args must match the required args.', () => {
    {
      const meta = preview.type<{ args: { disabled: boolean } }>().meta({
        component: ButtonComponent,
      });
      // @ts-expect-error disabled not provided ❌
      const Basic = meta.story({
        args: { label: 'good' },
      });
    }
    {
      const meta = preview.type<{ args: ButtonProps }>().meta({
        component: ButtonComponent,
        args: { label: 'good' },
      });
      // @ts-expect-error disabled not provided ❌
      const Basic = meta.story();
    }
    {
      const meta = preview.type<{ args: ButtonProps }>().meta({ component: ButtonComponent });
      // @ts-expect-error disabled not provided ❌
      const Basic = meta.story({
        args: { label: 'good' },
      });
    }
  });

  it("✅ Required args don't need to be provided when the user uses an empty render", () => {
    const meta = preview.type<{ args: ButtonProps }>().meta({
      component: ButtonComponent,
      args: { label: 'good' },
    });
    const Basic = meta.story({
      render: () => ({ template: '<div>Hello world</div>' }),
    });

    const CSF1 = meta.story(() => ({ template: '<div>Hello world</div>' }));
  });

  it('❌ Required args need to be provided when the user uses a non-empty render', () => {
    const meta = preview.type<{ args: ButtonProps }>().meta({
      component: ButtonComponent,
      args: { label: 'good' },
    });
    // @ts-expect-error disabled not provided ❌
    const Basic = meta.story({
      args: {
        label: 'good',
      },
      render: (args) => ({ template: '<div>Hello world</div>' }),
    });
  });
});

type ThemeData = 'light' | 'dark';

describe('Story args can be inferred', () => {
  it('Correct args are inferred when type is widened for render function', () => {
    const meta = preview.type<{ args: { theme: ThemeData } }>().meta({
      component: ButtonComponent,
      args: { disabled: false },
      render: (args) => {
        return {
          template: `<div class="theme-${args.theme}">
            <storybook-button [label]="label" [disabled]="disabled"></storybook-button>
          </div>`,
          props: args,
        };
      },
    });

    const Basic = meta.story({ args: { theme: 'light', label: 'good' } });
  });

  const withDecorator: Decorator<{ decoratorArg: number }> = (storyFunc, { args }) => {
    const story = storyFunc();
    return {
      ...story,
      template: `<div>Decorator: ${args.decoratorArg}<div style="margin: 1em">${story.template}</div></div>`,
    };
  };

  it('Correct args are inferred when type is widened for decorators', () => {
    const meta = preview.type<{ args: ButtonProps }>().meta({
      component: ButtonComponent,
      args: { disabled: false },
      decorators: [withDecorator],
    });

    const Basic = meta.story({ args: { decoratorArg: 0, label: 'good' } });
  });

  it('Correct args are inferred when type is widened for multiple decorators', () => {
    const secondDecorator: Decorator<{ decoratorArg2: string }> = (storyFunc, { args }) => {
      const story = storyFunc();
      return {
        ...story,
        template: `<div>Decorator: ${args.decoratorArg2}<div style="margin: 1em">${story.template}</div></div>`,
      };
    };

    // decorator is not using args
    const thirdDecorator: Decorator<Args> = (storyFunc) => {
      const story = storyFunc();
      return {
        ...story,
        template: `<div><div style="margin: 1em">${story.template}</div></div>`,
      };
    };

    // decorator is not using args
    const fourthDecorator: Decorator = (storyFunc) => {
      const story = storyFunc();
      return {
        ...story,
        template: `<div><div style="margin: 1em">${story.template}</div></div>`,
      };
    };

    const meta = preview.type<{ args: ButtonProps }>().meta({
      component: ButtonComponent,
      args: { disabled: false },
      decorators: [withDecorator, secondDecorator, thirdDecorator, fourthDecorator],
    });

    const Basic = meta.story({
      args: { decoratorArg: 0, decoratorArg2: '', label: 'good' },
    });
  });

  it('Component type can be overridden', () => {
    const meta = preview
      .type<{ args: Omit<ButtonProps, 'disabledChange'> & { disabledChange?: boolean } }>()
      .meta({
        render: ({ disabledChange, ...args }) => {
          return {
            template: `<storybook-button
              [label]="label"
              [disabled]="disabled"
              (disabledChange)="onDisabledChangeHandler && onDisabledChangeHandler($event)"
            ></storybook-button>`,
            props: {
              ...args,
              onDisabledChangeHandler: disabledChange ? () => {} : undefined,
            },
          };
        },
        args: { label: 'hello', disabledChange: false },
      });

    const Basic = meta.story({
      args: {
        disabled: false,
      },
    });
    const WithHandler = meta.story({ args: { disabled: false, disabledChange: true } });
  });

  it('Correct args are inferred when type is added in renderer', () => {
    const meta = preview.type<{ args: ButtonProps }>().meta({
      component: ButtonComponent,
      args: { label: 'hello', disabledChangeToggle: false },
      render: ({
        disabledChangeToggle,
        ...args
      }: ButtonProps & { disabledChangeToggle?: boolean }) => {
        return {
          template: `<storybook-button
            [label]="label"
            [disabled]="disabled"
            (disabledChange)="onDisabledChangeHandler && onDisabledChangeHandler($event)"
          ></storybook-button>`,
          props: {
            ...args,
            onDisabledChangeHandler: disabledChangeToggle ? () => {} : undefined,
          },
        };
      },
    });

    const Basic = meta.story({ args: { disabled: false } });
    const WithHandler = meta.story({ args: { disabled: false, disabledChangeToggle: true } });
  });

  it('Correct args are inferred when render arg type is required', () => {
    const meta = preview.type<{ args: { disabledChangeToggle: boolean } }>().meta({
      component: ButtonComponent,
      args: { label: 'hello' },
      render: (args) => {
        return {
          template: `<storybook-button
            [label]="label"
            [disabled]="disabled"
            (disabledChange)="onDisabledChangeHandler && onDisabledChangeHandler($event)"
          ></storybook-button>`,
          props: {
            ...args,
            onDisabledChangeHandler: args.disabledChangeToggle ? () => {} : undefined,
          },
        };
      },
    });

    // @ts-expect-error disabledChangeToggle is required
    const Basic = meta.story({ args: { disabled: false } });
    const WithHandler = meta.story({ args: { disabled: false, disabledChangeToggle: true } });
  });

  it('args can be reused', () => {
    const meta = preview.type<{ args: ButtonProps }>().meta({
      component: ButtonComponent,
    });

    const Enabled = meta.story({ args: { label: 'hello', disabled: false } });
    const Disabled = meta.story({ args: { ...Enabled.input.args, disabled: true } });
  });

  it('stories can be extended', () => {
    const meta = preview.type<{ args: ButtonProps }>().meta({
      component: ButtonComponent,
    });

    const Enabled = meta.story({ args: { label: 'hello', disabled: false } });
    const Disabled = Enabled.extend({ args: { disabled: true } });
  });
});

it('Components without Props can be used', () => {
  @Component({
    selector: 'storybook-simple',
    standalone: true,
    template: ` <div>Simple</div> `,
  })
  class SimpleComponent {}

  const withDecorator: Decorator = (storyFunc) => {
    const story = storyFunc();
    return {
      ...story,
      template: `<div><div style="margin: 1em">${story.template}</div></div>`,
    };
  };

  const meta = preview.meta({
    component: SimpleComponent,
    decorators: [withDecorator],
  });

  const Basic = meta.story();
});

it('Signal components can be used', () => {
  @Component({
    standalone: false,
    // Needs to be a different name to the CLI template button
    selector: 'storybook-signal-button',
    template: `
      <button
        type="button"
        (click)="onClick.emit($event)"
        [ngClass]="classes"
        [ngStyle]="{ 'background-color': backgroundColor }"
      >
        {{ label() }}
      </button>
    `,
  })
  class SignalButtonComponent {
    /** Is this the principal call to action on the page? */
    primary = input(false);

    /** What background color to use */
    @Input()
    backgroundColor?: string;

    /** How large should the button be? */
    size = input('medium', {
      transform: (val: 'small' | 'medium') => val,
    });

    /** Button contents */
    label = input.required<string>();

    /** Optional click handler */
    onClick = output<Event>();

    public get classes(): string[] {
      const mode = this.primary() ? 'storybook-button--primary' : 'storybook-button--secondary';

      return ['storybook-button', `storybook-button--${this.size()}`, mode];
    }
  }

  const meta = preview.meta({
    component: SignalButtonComponent,
  });

  const Basic = meta.story({
    args: {
      backgroundColor: 'red',
      size: 'small',
      label: '1',
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

  @Component({ selector: 'storybook-card', standalone: true, template: '' })
  class Card {
    variant = input<'primary' | 'secondary'>('primary');
    @Input() size!: Size;
    @Input() icon!: `icon-${string}`;
    @Input() userId!: UserId;
    @Input() range!: [min: number, max: number];
    @Input() items!: string[];
    @Input() config!: {
      theme: { mode: 'light' | 'dark'; accents: { tone: 'warm' | 'cool' }[] };
    };
    @Input() shape!: Shape;
    @Input() store!: Store;
    @Input() handlers!: { onSelect: (item: string) => void; onReset: () => void };
    @Input() getUsers!: () => Promise<string[]>;
    @Input() onClick!: () => void;
    changed = output<number>();
  }

  const meta = preview.type<{ args: { label: string } }>().meta({
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
      changed: (value) => expectTypeOf(value).toEqualTypeOf<number>(),
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
    // @ts-expect-error not an input of Card
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
    const complete = preview.type<{ args: ButtonProps }>().meta({
      component: ButtonComponent,
      args: { label: 'Hi', disabled: false },
    });
    const Default = complete.story();
  });

  it('union props accept keys shared by every member', () => {
    type Props = { label: string } & (
      | { kind: 'link'; href: string }
      | { kind: 'button'; onPress: () => void }
    );
    const render = (args: Props) => ({ props: args });

    const actionMeta = preview.meta({ render, args: { label: 'Go', kind: 'link' } });
    const Link = actionMeta.story({ args: { href: '/' } });

    // @ts-expect-error href is not a prop of every member, set it per story
    preview.meta({ render, args: { kind: 'link', href: '/' } });
  });

  it('args declared with preview.type<>() and decorators', () => {
    const withTheme: Decorator<{ theme: 'light' | 'dark' }> = (storyFn) => storyFn();

    const typedMeta = preview.type<{ args: { locale: 'en' | 'nl' } }>().meta({
      component: ButtonComponent,
      decorators: [withTheme],
      args: { locale: 'nl', theme: 'dark', label: 'Hi' },
    });
    const Default = typedMeta.story({ args: { disabled: false } });
    expectTypeOf(typedMeta.input.args.locale).toEqualTypeOf<'en' | 'nl'>();
  });

  it('render-only meta', () => {
    const renderMeta = preview.meta({
      render: (args: { mode: 'compact' | 'wide'; count: number }) => ({ props: args }),
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
  @Component({ selector: 'example-button', template: '' })
  class ExampleButton {
    @Input() primary = false;
    @Input() backgroundColor?: string;
    @Input() size: 'small' | 'medium' | 'large' = 'medium';
    @Input() label = 'Button';
    @Output() onClick = new EventEmitter<Event>();
  }

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
    render: (args) => ({ props: args }),
    argTypes: { size: { control: 'select', options: ['small', 'large'] } },
  });

  const Default = meta.story({ args: { label: 'Hi' } });
});

it('a render typed as any or as the component keeps the component args', () => {
  const render = (args: any) => ({ props: args });
  const anyRender = preview.meta({ component: ButtonComponent, render });
  // @ts-expect-error not a boolean
  const Invalid = anyRender.story({ args: { disabled: 'yes' } });
  // @ts-expect-error bogus is not an arg
  preview.meta({ component: ButtonComponent, render, args: { bogus: 1 } });

  const componentRender = preview.meta({
    component: ButtonComponent,
    render: (args: ButtonComponent) => ({ props: args }),
  });
  const Default = componentRender.story({ args: { label: 'Hi' } });
});
