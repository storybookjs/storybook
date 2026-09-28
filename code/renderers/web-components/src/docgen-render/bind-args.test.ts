/** @vitest-environment happy-dom */
import type { Args, StrictArgTypes, StrictInputType } from 'storybook/internal/types';

import { describe, expect, it, vi } from 'vitest';

import { ARG_TYPE_CATEGORIES } from '../docgen/component-docgen/arg-types/categories.ts';
import { bindArgs } from './bind-args.ts';

const X_DEMO_TAG = 'x-demo';

type SerializableCase = {
  name: string;
  argTypes: StrictArgTypes;
  args: Args;
  expected: string;
  prepare?: (element: HTMLElement) => void;
  assert?: (element: HTMLElement, result: Node) => void;
};

describe('bindArgs', () => {
  it.each<SerializableCase>([
    {
      name: 'sets string and number attributes',
      argTypes: {
        label: attributeArgType('label', 'string'),
        count: attributeArgType('count', 'number'),
      },
      args: { label: 'Demo', count: 3 },
      expected: '<x-demo label="Demo" count="3"></x-demo>',
    },
    {
      name: 'sets true boolean attributes and removes false boolean attributes',
      argTypes: {
        isOpen: attributeArgType('is-open', 'boolean'),
        disabled: attributeArgType('disabled', 'boolean'),
      },
      args: { isOpen: true, disabled: false },
      expected: '<x-demo is-open=""></x-demo>',
      prepare: (element) => element.setAttribute('disabled', ''),
    },
    {
      name: 'toggles untyped attributes for boolean values',
      argTypes: {
        disabled: argType('disabled', ARG_TYPE_CATEGORIES.attributes),
        active: argType('active', ARG_TYPE_CATEGORIES.attributes),
      },
      args: { disabled: false, active: true },
      expected: '<x-demo active=""></x-demo>',
      prepare: (element) => element.setAttribute('disabled', ''),
    },
    {
      name: 'serializes object attribute values as JSON',
      argTypes: {
        tags: attributeArgType('tags', 'array'),
      },
      args: { tags: ['a', 'b'] },
      expected: '<x-demo tags="[&quot;a&quot;,&quot;b&quot;]"></x-demo>',
    },
    {
      name: 'leaves undefined and null attributes untouched',
      argTypes: {
        label: attributeArgType('label', 'string'),
        count: attributeArgType('count', 'number'),
      },
      args: { label: undefined, count: null },
      expected: '<x-demo label="Original" count="7"></x-demo>',
      prepare: (element) => {
        element.setAttribute('label', 'Original');
        element.setAttribute('count', '7');
      },
    },
    {
      name: 'sets CSS custom properties',
      argTypes: {
        '--panel-color': argType('--panel-color', ARG_TYPE_CATEGORIES.cssProperties),
      },
      args: { '--panel-color': 'red' },
      expected: '<x-demo style="--panel-color: red;"></x-demo>',
      assert: (element) => {
        expect(element.style.getPropertyValue('--panel-color')).toBe('red');
      },
    },
    {
      name: 'appends default and named slot HTML',
      argTypes: {
        'default-slot': argType('default', ARG_TYPE_CATEGORIES.slots),
        'actions-slot': argType('actions', ARG_TYPE_CATEGORIES.slots),
      },
      args: {
        'default-slot': '<strong>Hello</strong>',
        'actions-slot': '<button>Go</button>Text',
      },
      expected:
        '<x-demo><strong>Hello</strong><button slot="actions">Go</button><span slot="actions">Text</span></x-demo>',
    },
    {
      name: 'returns a fragment with scoped part and state rules',
      argTypes: {
        'panel-part': argType('panel', ARG_TYPE_CATEGORIES.cssParts),
        'active-state': argType('active', ARG_TYPE_CATEGORIES.cssStates),
      },
      args: {
        'panel-part': 'color: red;',
        'active-state': 'border: 0;',
      },
      expected:
        '<style>style + x-demo::part(panel) { color: red; }\nstyle + x-demo:state(active) { border: 0; }</style><x-demo></x-demo>',
    },
    {
      name: 'returns the element when no scoped style rules are bound',
      argTypes: {
        label: attributeArgType('label', 'string'),
      },
      args: { label: 'Demo' },
      expected: '<x-demo label="Demo"></x-demo>',
      assert: (element, result) => {
        expect(result).toBe(element);
      },
    },
    {
      name: 'assigns unknown arg keys as properties',
      argTypes: {},
      args: { customValue: 42 },
      expected: '<x-demo></x-demo>',
      assert: (element) => {
        expect((element as HTMLElement & { customValue?: number }).customValue).toBe(42);
      },
    },
    {
      name: 'assigns properties without setting attributes',
      argTypes: {
        isOpen: argType('isOpen', ARG_TYPE_CATEGORIES.properties),
      },
      args: { isOpen: true },
      expected: '<x-demo></x-demo>',
      assert: (element) => {
        expect((element as HTMLElement & { isOpen?: boolean }).isOpen).toBe(true);
        expect(element.hasAttribute('isOpen')).toBe(false);
      },
    },
    {
      name: 'assigns undefined property rows',
      argTypes: {
        value: argType('value', ARG_TYPE_CATEGORIES.properties),
      },
      args: { value: undefined },
      expected: '<x-demo></x-demo>',
      assert: (element) => {
        expect(Object.hasOwn(element, 'value')).toBe(true);
        expect((element as HTMLElement & { value?: unknown }).value).toBeUndefined();
      },
    },
  ])('$name', ({ argTypes, args, expected, prepare, assert }) => {
    const element = document.createElement(X_DEMO_TAG);
    prepare?.(element);

    const result = bindArgs(element, args, argTypes);
    const host = document.createElement('div');
    host.append(result);

    expect(host.innerHTML).toBe(expected);
    assert?.(element, result);
  });

  it('binds event rows to function-valued action args', () => {
    const element = document.createElement(X_DEMO_TAG);
    const handler = vi.fn();

    bindArgs(
      element,
      { onMyChange: handler },
      {
        onMyChange: {
          name: 'onMyChange',
          action: { name: 'my-change' },
          table: { disable: true },
        },
      }
    );

    const event = new CustomEvent('my-change');
    element.dispatchEvent(event);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('does not bind event listeners for non-function action args', () => {
    const element = document.createElement(X_DEMO_TAG);
    const addEventListener = vi.spyOn(element, 'addEventListener');

    bindArgs(
      element,
      { onMyChange: 'handler-name' },
      {
        onMyChange: {
          name: 'onMyChange',
          action: { name: 'my-change' },
          table: { disable: true },
        },
      }
    );

    expect(addEventListener).not.toHaveBeenCalled();
    expect(Object.hasOwn(element, 'onMyChange')).toBe(false);
  });

  it('does not assign action twin or method rows as properties', () => {
    const element = document.createElement(X_DEMO_TAG);

    bindArgs(
      element,
      { onMyChange: vi.fn(), 'reset-method': vi.fn() },
      {
        onMyChange: {
          name: 'onMyChange',
          action: { name: 'my-change' },
          table: { disable: true },
        },
        'reset-method': argType('reset', ARG_TYPE_CATEGORIES.methods),
      }
    );

    expect(Object.hasOwn(element, 'onMyChange')).toBe(false);
    expect(Object.hasOwn(element, 'reset')).toBe(false);
    expect(Object.hasOwn(element, 'reset-method')).toBe(false);
  });
});

function argType(name: string, category: string): StrictInputType {
  return {
    name,
    table: { category },
  };
}

function attributeArgType(name: string, typeName: string): StrictInputType {
  return {
    ...argType(name, ARG_TYPE_CATEGORIES.attributes),
    type: { name: typeName },
  } as StrictInputType;
}
