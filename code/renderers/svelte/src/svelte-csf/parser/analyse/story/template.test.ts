import { describe, expect, it } from 'vitest';
import { dedent } from 'ts-dedent';

import { fillTemplate } from '../../../../docs/fill-template.ts';
import { getStoryContentTemplate } from './template.ts';

describe(getStoryContentTemplate.name, () => {
  it('marks a spread as the props the element does not write itself', () => {
    expect(getStoryContentTemplate('<Button {...args} />')).toBe('<Button ⟦props⟧ />');
    expect(getStoryContentTemplate('<Button {...args} onclick={handleClick}>Go</Button>')).toBe(
      '<Button ⟦props -onclick -children⟧ onclick={handleClick}>Go</Button>'
    );
  });

  it('marks an attribute, text and an expression that read one arg', () => {
    const template = getStoryContentTemplate(dedent`
      <Button
        label={args.label}
        size="small"
      >
        {args?.children}
        {#if args['loading']}…{/if}
      </Button>`);
    expect(template).toMatchInlineSnapshot(`
      "<Button
        ⟦attr label label⟧
        size="small"
      >
        ⟦text children⟧
        {#if ⟦value loading⟧}…{/if}
      </Button>"
    `);
    expect(fillTemplate(template!, { label: 'Go', children: 'Save', loading: true }))
      .toMatchInlineSnapshot(`
        "<Button
          label="Go"
          size="small"
        >
          Save
          {#if true}…{/if}
        </Button>"
      `);
  });

  it('leaves out of a spread the props the element writes after it, and marks those before', () => {
    expect(getStoryContentTemplate('<Input label="L" {...args} bind:value size="sm" />')).toBe(
      '<Input label="L" ⟦props ^label -value -size⟧ bind:value size="sm" />'
    );
  });

  it('reads TypeScript, and keeps a literal the code reads on apart', () => {
    const template = getStoryContentTemplate('<Meter value={-args.n} text={args.n.toFixed(2)} />');
    expect(template).toBe('<Meter value={-⟦operand n⟧} text={⟦operand n⟧.toFixed(2)} />');
    expect(fillTemplate(template!, { n: -1 })).toBe(
      '<Meter value={-(-1)} text={(-1).toFixed(2)} />'
    );
    expect(getStoryContentTemplate('<p>{args.label!}</p>')).toBe('<p>{⟦value label⟧!}</p>');
  });

  it('reads an arg named with a space, as one word', () => {
    const template = getStoryContentTemplate(`<Button title={args['Button title']} />`);
    expect(template).toBe('<Button ⟦attr title %Button%20title⟧ />');
    expect(fillTemplate(template!, { 'Button title': 'Go on' })).toBe('<Button title="Go on" />');
  });

  it('is undefined for args no hole stands for', () => {
    for (const code of [
      '<Button />',
      '<Button {args} />',
      '<Button data={args} />',
      '<Button label={args[name]} />',
      '<Input bind:value={args.value} />',
      '<Button onclick={() => args.count++} />',
      '<Button onclick={() => (args.label = "x")} />',
      '<p>⟦text label⟧ {args.label}</p>',
      '<p>{unclosed</p>',
    ]) {
      expect(getStoryContentTemplate(code), code).toBeUndefined();
    }
  });
});
