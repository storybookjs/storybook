// this file tests Typescript types that's why there are no assertions
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { describe, expect, it, test } from 'vitest';

import type { Args } from 'storybook/internal/types';

import { __definePreview } from './preview';
import type { Decorator } from './public-types';

@Component({
  selector: 'storybook-button',
  standalone: true,
  template: `<button [disabled]="disabled">{{ label }}</button>`,
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
    template: `<div>Simple</div>`,
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
