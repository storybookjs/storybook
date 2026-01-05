// this file tests Typescript types that's why there are no assertions
import { describe, expect, it, test } from 'vitest';

import type { Args } from 'storybook/internal/types';

import { html } from 'lit';

import { __definePreview } from './preview';
import type { Decorator } from './public-types';

type ButtonProps = { label: string; disabled: boolean; onKeyDown?: () => void };

const preview = __definePreview({
  addons: [],
});

test('csf factories', () => {
  const meta = preview.type<{ args: ButtonProps }>().meta({
    component: 'my-button',
    args: { disabled: true },
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
    const meta = preview.type<{ args: ButtonProps }>().meta({
      component: 'my-button',
      args: { label: 'good', disabled: false },
    });

    const Basic = meta.story({});
  });

  it('✅ Required args may be provided partial in meta and the story', () => {
    const meta = preview.type<{ args: ButtonProps }>().meta({
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
    const meta = preview.type<{ args: ButtonProps }>().meta({
      component: 'my-button',
      args: { label: 'good' },
    });
    const Basic = meta.story({
      render: () => html`<div>Hello world</div>`,
    });

    const CSF1 = meta.story(() => html`<div>Hello world</div>`);
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
      render: (args) => html`<div>Hello world</div>`,
    });
  });
});

type ThemeData = 'light' | 'dark';

describe('Story args can be inferred', () => {
  it('Correct args are inferred when type is widened for render function', () => {
    const meta = preview.type<{ args: ButtonProps }>().meta({
      component: 'my-button',
      args: { disabled: false },
      render: (args: ButtonProps & { theme: ThemeData }) => {
        return html`<div class="theme-${args.theme}">
          <my-button .label=${args.label} .disabled=${args.disabled}></my-button>
        </div>`;
      },
    });

    const Basic = meta.story({ args: { theme: 'light', label: 'good' } });
  });

  const withDecorator: Decorator<{ decoratorArg: number }> = (Story, { args }) => html`
    <div>Decorator: ${args.decoratorArg} ${Story()}</div>
  `;

  it('Correct args are inferred when type is widened for decorators', () => {
    const meta = preview.type<{ args: ButtonProps }>().meta({
      component: 'my-button',
      args: { disabled: false },
      decorators: [withDecorator],
    });

    const Basic = meta.story({ args: { decoratorArg: 0, label: 'good' } });
  });

  it('Correct args are inferred when type is widened for multiple decorators', () => {
    type Props = ButtonProps & { decoratorArg: number; decoratorArg2: string };

    const secondDecorator: Decorator<{ decoratorArg2: string }> = (Story, { args }) => html`
      <div>Decorator: ${args.decoratorArg2} ${Story()}</div>
    `;

    // decorator is not using args
    const thirdDecorator: Decorator<Args> = (Story) => html` <div>${Story()}</div> `;

    // decorator is not using args
    const fourthDecorator: Decorator = (Story) => html` <div>${Story()}</div> `;

    const meta = preview.type<{ args: ButtonProps }>().meta({
      component: 'my-button',
      args: { disabled: false },
      decorators: [withDecorator, secondDecorator, thirdDecorator, fourthDecorator],
    });

    const Basic = meta.story({
      args: { decoratorArg: 0, decoratorArg2: '', label: 'good' },
    });
  });

  it('Component type can be overridden', () => {
    const meta = preview
      .type<{ args: Omit<ButtonProps, 'onKeyDown'> & { onKeyDown?: boolean } }>()
      .meta({
        component: 'my-button',
        render: ({ onKeyDown, ...args }) => {
          return html`<my-button
            .label=${args.label}
            .disabled=${args.disabled}
            .onKeyDown=${onKeyDown ? () => {} : undefined}
          ></my-button>`;
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
    const meta = preview.type<{ args: ButtonProps }>().meta({
      component: 'my-button',
      args: { label: 'hello', onKeyDownToggle: false },
      render: ({ onKeyDownToggle, ...args }: ButtonProps & { onKeyDownToggle?: boolean }) => {
        return html`<my-button
          .label=${args.label}
          .disabled=${args.disabled}
          .onKeyDown=${onKeyDownToggle ? () => {} : undefined}
        ></my-button>`;
      },
    });

    const Basic = meta.story({ args: { disabled: false } });
    const WithKeyDown = meta.story({ args: { disabled: false, onKeyDownToggle: true } });
  });

  it('args can be reused', () => {
    const meta = preview.type<{ args: ButtonProps }>().meta({
      component: 'my-button',
    });

    const Enabled = meta.story({ args: { label: 'hello', disabled: false } });
    const Disabled = meta.story({ args: { ...Enabled.input.args, disabled: true } });
  });

  it('stories can be extended', () => {
    const meta = preview.type<{ args: ButtonProps }>().meta({
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
