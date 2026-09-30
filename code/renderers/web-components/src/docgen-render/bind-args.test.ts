/** @vitest-environment happy-dom */
import type { Args, Parameters, StrictArgTypes, StrictInputType } from 'storybook/internal/types';

import { action } from 'storybook/actions';
import { describe, expect, it, vi } from 'vitest';

import { ARG_TYPE_CATEGORIES } from '../arg-type-categories.ts';
import { bindArgs } from './bind-args.ts';

vi.mock('storybook/actions', () => ({ action: vi.fn(() => vi.fn()) }));

const X_DEMO_TAG = 'x-demo';

type SerializableCase = {
  name: string;
  argTypes: StrictArgTypes;
  args: Args;
  parameters?: Parameters;
  expected: string;
  assert?: (element: HTMLElement, result: Node, args: Args) => void;
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
      name: 'sets true boolean attributes and skips false ones',
      argTypes: {
        isOpen: attributeArgType('is-open', 'boolean'),
        disabled: attributeArgType('disabled', 'boolean'),
      },
      args: { isOpen: true, disabled: false },
      expected: '<x-demo is-open=""></x-demo>',
    },
    {
      name: 'sets true untyped attributes and skips false ones',
      argTypes: {
        disabled: argType('disabled', ARG_TYPE_CATEGORIES.attributes),
        active: argType('active', ARG_TYPE_CATEGORIES.attributes),
      },
      args: { disabled: false, active: true },
      expected: '<x-demo active=""></x-demo>',
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
      name: 'leaves undefined and null attributes unset',
      argTypes: {
        label: attributeArgType('label', 'string'),
        count: attributeArgType('count', 'number'),
      },
      args: { label: undefined, count: null },
      expected: '<x-demo></x-demo>',
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
      name: 'assigns unrecognized categories as properties',
      argTypes: {
        customValue: argType('customValue', 'custom category'),
      },
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
    {
      name: 'binds event rows to function-valued action args',
      argTypes: {
        onMyChange: {
          name: 'onMyChange',
          action: { name: 'my-change' },
          table: { disable: true },
        },
      },
      args: { onMyChange: vi.fn() },
      expected: '<x-demo></x-demo>',
      assert: (element, _result, args) => {
        const event = new CustomEvent('my-change');
        element.dispatchEvent(event);

        expect(args.onMyChange).toHaveBeenCalledOnce();
        expect(args.onMyChange).toHaveBeenCalledWith(event);
      },
    },
    {
      name: 'does not bind event listeners for non-function action args',
      argTypes: {
        onMyChange: {
          name: 'onMyChange',
          action: { name: 'my-change' },
          table: { disable: true },
        },
      },
      args: { onMyChange: 'handler-name' },
      expected: '<x-demo></x-demo>',
      assert: (element) => {
        expect(action).not.toHaveBeenCalled();
        expect(Object.hasOwn(element, 'onMyChange')).toBe(false);
      },
    },
    {
      name: 'does not assign action twin, event, method, or uncategorized rows as properties',
      argTypes: {
        onMyChange: {
          name: 'onMyChange',
          action: { name: 'my-change' },
          table: { disable: true },
        },
        'my-change-event': argType('my-change', ARG_TYPE_CATEGORIES.events),
        'reset-method': argType('reset', ARG_TYPE_CATEGORIES.methods),
        value: { name: 'value' },
      },
      args: {
        onMyChange: vi.fn(),
        'my-change-event': 'my-change',
        'reset-method': vi.fn(),
        value: 'x',
      },
      expected: '<x-demo></x-demo>',
      assert: (element) => {
        expect(Object.hasOwn(element, 'onMyChange')).toBe(false);
        expect(Object.hasOwn(element, 'my-change')).toBe(false);
        expect(Object.hasOwn(element, 'my-change-event')).toBe(false);
        expect(Object.hasOwn(element, 'reset')).toBe(false);
        expect(Object.hasOwn(element, 'reset-method')).toBe(false);
        expect(Object.hasOwn(element, 'value')).toBe(false);
      },
    },
  ])('$name', ({ argTypes, args, parameters = {}, expected, assert }) => {
    vi.clearAllMocks();
    const element = document.createElement(X_DEMO_TAG);
    const result = bindArgs(element, args, argTypes, parameters);
    const host = document.createElement('div');
    host.append(result);

    expect(host.innerHTML).toBe(expected);
    assert?.(element, result, args);
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
