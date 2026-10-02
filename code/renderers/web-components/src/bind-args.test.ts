/** @vitest-environment happy-dom */
import type { Args } from 'storybook/internal/types';

import { describe, expect, it, vi } from 'vitest';

import { bindArgs } from './bind-args.ts';

const X_DEMO_TAG = 'x-demo';

class XDemo extends HTMLElement {
  static observedAttributes = ['label', 'count', 'is-open', 'disabled', 'has-slot', 'open'];

  items: string[] = [];

  open = true;

  text = 'initial';
}

if (!customElements.get(X_DEMO_TAG)) {
  customElements.define(X_DEMO_TAG, XDemo);
}

type BindArgsCase = {
  name: string;
  args: Args;
  expected: string;
  expectedRules?: string[];
  expectedProperties?: Record<string, unknown>;
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
      name: 'assigns false to a boolean property that is also observed',
      args: { open: false },
      expected: '<x-demo></x-demo>',
      expectedProperties: { open: false },
    },
    {
      name: 'assigns an empty string to a string property',
      args: { text: '' },
      expected: '<x-demo></x-demo>',
      expectedProperties: { text: '' },
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
      expected: '<x-demo></x-demo>',
      expectedRules: ['x-demo::part(panel) { color: red; }', 'x-demo:state(active) { border: 0; }'],
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
  ])('$name', ({ args, expected, expectedRules = [], expectedProperties = {} }) => {
    const element = document.createElement(X_DEMO_TAG);
    const result = bindArgs(element, args);

    expect(element.outerHTML).toBe(expected);
    expect(result).toEqual(expectedRules);
    for (const [key, value] of Object.entries(expectedProperties)) {
      expect((element as HTMLElement & Record<string, unknown>)[key]).toEqual(value);
    }
  });

  it('binds function-valued event args', () => {
    const handler = vi.fn();
    const element = document.createElement(X_DEMO_TAG);
    bindArgs(element, { 'my-change-event': handler });
    const event = new CustomEvent('my-change');
    element.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('does not bind or assign non-function event args', () => {
    const element = document.createElement(X_DEMO_TAG);
    bindArgs(element, { 'my-change-event': 'handler-name' });
    element.dispatchEvent(new CustomEvent('my-change'));

    expect((element as HTMLElement & Record<string, unknown>)['my-change-event']).toBeUndefined();
  });

  it('assigns action twin keys as properties without binding listeners', () => {
    const handler = vi.fn();
    const element = document.createElement(X_DEMO_TAG);
    bindArgs(element, { onMyChange: handler });
    element.dispatchEvent(new CustomEvent('my-change'));

    expect((element as HTMLElement & { onMyChange?: unknown }).onMyChange).toBe(handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns an empty rules list without style rules', () => {
    expect(bindArgs(document.createElement(X_DEMO_TAG), {})).toEqual([]);
  });
});
