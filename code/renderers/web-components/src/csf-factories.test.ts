// this file primarily tests TypeScript types with some runtime assertions
import { describe, expect, it, test } from 'vitest';

import type { Args } from 'storybook/internal/types';

import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { __definePreview } from './preview';
import type { Decorator } from './public-types';

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
    return html`<button></button>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'my-button': MyButton;
    'my-component': MyComponent;
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
