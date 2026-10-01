/** @vitest-environment happy-dom */
import type { Args } from 'storybook/internal/types';

import { describe, expect, it, vi } from 'vitest';

import { bindArgs } from './bind-args.ts';

const X_DEMO_TAG = 'x-demo';

class XDemo extends HTMLElement {
  static observedAttributes = ['label', 'count', 'is-open', 'disabled', 'has-slot'];

  items: string[] = [];
}

if (!customElements.get(X_DEMO_TAG)) {
  customElements.define(X_DEMO_TAG, XDemo);
}

type BindArgsCase = {
  name: string;
  args: Args;
  expected: string;
  expectedProperties?: Record<string, unknown>;
  dispatch?: (element: HTMLElement, args: Args) => void;
};

describe('bindArgs', () => {
  it.each<BindArgsCase>([
    {
      name: 'sets observed string and number attributes',
      args: { label: 'Demo', count: 3 },
      expected: '<x-demo label="Demo" count="3"></x-demo>',
    },
    {
      name: 'sets true observed attributes and skips false ones',
      args: { 'is-open': true, disabled: false },
      expected: '<x-demo is-open=""></x-demo>',
    },
    {
      name: 'leaves undefined, null and empty observed attributes unset',
      args: { label: undefined, count: null, 'is-open': '' },
      expected: '<x-demo></x-demo>',
    },
    {
      name: 'assigns object-valued observed keys as properties',
      args: { label: { text: 'Demo' } },
      expected: '<x-demo></x-demo>',
      expectedProperties: { label: { text: 'Demo' } },
    },
    {
      name: 'assigns property-only keys as properties',
      args: { items: ['a', 'b'] },
      expected: '<x-demo></x-demo>',
      expectedProperties: { items: ['a', 'b'] },
    },
    {
      name: 'assigns unknown arg keys as properties',
      args: { customValue: 42 },
      expected: '<x-demo></x-demo>',
      expectedProperties: { customValue: 42 },
    },
    {
      name: 'sets CSS custom properties',
      args: { '--panel-color': 'red' },
      expected: '<x-demo style="--panel-color: red;"></x-demo>',
    },
    {
      name: 'appends default and named slot HTML',
      args: {
        'default-slot': '<strong>Hello</strong>',
        'actions-slot': '<button>Go</button>Text',
      },
      expected:
        '<x-demo><strong>Hello</strong><button slot="actions">Go</button><span slot="actions">Text</span></x-demo>',
    },
    {
      name: 'puts scoped part and state rules before the element',
      args: {
        'panel-part': 'color: red;',
        'active-state': 'border: 0;',
      },
      expected:
        '<style>@scope {\n  x-demo::part(panel) { color: red; }\n  x-demo:state(active) { border: 0; }\n}</style><x-demo></x-demo>',
    },
    {
      name: 'skips null and empty slot, CSS custom property, part and state args',
      args: {
        'default-slot': null,
        'actions-slot': '',
        '--panel-color': null,
        'panel-part': null,
        'active-state': '',
      },
      expected: '<x-demo></x-demo>',
    },
    {
      name: 'binds function-valued event args',
      args: { 'my-change-event': vi.fn() },
      expected: '<x-demo></x-demo>',
      dispatch: (element, args) => {
        const event = new CustomEvent('my-change');
        element.dispatchEvent(event);

        expect(args['my-change-event']).toHaveBeenCalledWith(event);
      },
    },
    {
      name: 'does not bind or assign non-function event args',
      args: { 'my-change-event': 'handler-name' },
      expected: '<x-demo></x-demo>',
      expectedProperties: { 'my-change-event': undefined },
    },
    {
      name: 'does not assign method args',
      args: { 'reset-method': vi.fn() },
      expected: '<x-demo></x-demo>',
      expectedProperties: { reset: undefined, 'reset-method': undefined },
    },
    {
      name: 'binds suffix-looking observed attributes before slots',
      args: { 'has-slot': 'yes' },
      expected: '<x-demo has-slot="yes"></x-demo>',
    },
    {
      name: 'assigns action twin keys as properties without binding listeners',
      args: { onMyChange: vi.fn() },
      expected: '<x-demo></x-demo>',
      dispatch: (element, args) => {
        element.dispatchEvent(new CustomEvent('my-change'));

        expect((element as HTMLElement & { onMyChange?: unknown }).onMyChange).toBe(
          args.onMyChange
        );
        expect(args.onMyChange).not.toHaveBeenCalled();
      },
    },
  ])('$name', ({ args, expected, expectedProperties = {}, dispatch }) => {
    const element = document.createElement(X_DEMO_TAG);
    const result = bindArgs(element, args);
    const host = document.createElement('div');
    host.append(result);

    expect(host.innerHTML).toBe(expected);
    for (const [key, value] of Object.entries(expectedProperties)) {
      expect((element as HTMLElement & Record<string, unknown>)[key]).toEqual(value);
    }
    dispatch?.(element, args);
  });

  it('returns a fragment even without style rules', () => {
    expect(bindArgs(document.createElement(X_DEMO_TAG), {})).toBeInstanceOf(DocumentFragment);
  });
});
