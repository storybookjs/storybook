// this file primarily tests TypeScript types with some runtime assertions
import { Component, EventEmitter, input, Input, output, Output } from '@angular/core';
import { describe, expect, it, test } from 'vitest';

import type { Args } from 'storybook/internal/types';

import { __definePreview } from './preview.ts';
import type { Decorator } from './public-types.ts';

@Component({
  selector: 'storybook-button',
  standalone: true,
  template: `
    <button [disabled]="disabled">{{ label }}</button>
  `,
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

describe('Custom args types written by the csf-factories codemod', () => {
  type Icon = { name: string };
  type StoryArgs = { pageIcon: Icon };

  it('✅ A custom arg can be set in meta and used in a story', () => {
    const meta = preview.type<{ args: StoryArgs }>().meta({
      component: ButtonComponent,
      args: { pageIcon: { name: 'organization' } },
    });

    const Default = meta.story({
      args: { label: 'good' },
      render: ({ pageIcon, ...args }) => ({
        props: args,
        template: `${pageIcon.name} <storybook-button [label]="label"></storybook-button>`,
      }),
    });
    const Overridden = meta.story({ args: { pageIcon: { name: 'user' } } });
  });

  it('✅ A custom arg can be used when meta has no component', () => {
    const meta = preview.type<{ args: StoryArgs }>().meta({
      render: (args) => ({ props: args, template: `${args.pageIcon.name}` }),
      args: { pageIcon: { name: 'organization' } },
    });

    const Default = meta.story();
    const Overridden = meta.story({ args: { pageIcon: { name: 'user' } } });
  });

  type ButtonAndCustomArgs = ButtonComponent & { footer?: string };

  it('❌ A custom args type that includes the component class requires every member of that class', () => {
    const meta = preview.type<{ args: ButtonAndCustomArgs }>().meta({
      component: ButtonComponent,
    });

    // @ts-expect-error label, disabled and disabledChange not provided ❌
    const CustomFooter = meta.story({ args: { footer: 'good' } });
  });

  it('✅ The component class can be left out of a custom args type', () => {
    const meta = preview.type<{ args: { footer?: string } }>().meta({
      component: ButtonComponent,
      render: ({ footer, ...args }) => ({ props: args, template: `${footer} ${args.label}` }),
    });

    const CustomFooter = meta.story({ args: { footer: 'good' } });
  });

  it('✅ The keys of the component class can be omitted from a custom args type', () => {
    const meta = preview.type<{ args: Omit<ButtonAndCustomArgs, keyof ButtonComponent> }>().meta({
      component: ButtonComponent,
      render: ({ footer, ...args }) => ({ props: args, template: `${footer} ${args.label}` }),
    });

    const CustomFooter = meta.story({ args: { footer: 'good' } });
  });
});

it('Components without Props can be used', () => {
  @Component({
    selector: 'storybook-simple',
    standalone: true,
    template: `
      <div>Simple</div>
    `,
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
