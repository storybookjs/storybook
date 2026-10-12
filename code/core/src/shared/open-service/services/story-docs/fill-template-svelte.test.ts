import { describe, expect, it } from 'vitest';

import { fillTemplate } from './fill-template-by-syntax.ts';

describe('fillSvelteTemplate', () => {
  it('spreads args as Svelte props and fills args references', () => {
    expect(
      fillTemplate(
        '<Button {...args} onclick={args.onclick}>{args.children}</Button>',
        { primary: true, label: 'Click', children: 'Hello', onclick: function handle() {} },
        'svelte'
      )
    ).toBe('<Button primary label="Click" onclick={handle} onclick={handle}>Hello</Button>');
  });

  it('fills nested paths', () => {
    expect(
      fillTemplate('<List first={args.items[0]["label"]} />', { items: [{ label: 'a' }] }, 'svelte')
    ).toBe('<List first={"a"} />');
  });
});
