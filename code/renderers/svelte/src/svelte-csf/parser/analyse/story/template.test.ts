import { describe, expect, it } from 'vitest';
import { dedent } from 'ts-dedent';

import { babelParse, type types as t } from 'storybook/internal/babel';
import { writtenArg } from 'storybook/internal/docs-tools';

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
    const template = getStoryContentTemplate(
      '<Meter value={-args.n} text={args.n.toFixed(2)} total={a-args.n} />'
    );
    expect(template).toBe(
      '<Meter value={-⟦operand n⟧} text={⟦operand n⟧.toFixed(2)} total={a-⟦operand n⟧} />'
    );
    expect(fillTemplate(template!, { n: -1 })).toBe(
      '<Meter value={-(-1)} text={(-1).toFixed(2)} total={a-(-1)} />'
    );
    expect(getStoryContentTemplate('<p>{args.label!}</p>')).toBe('<p>{⟦value label⟧!}</p>');
  });

  it('keeps written code apart next to an operator, but not plain data', () => {
    const written = (code: string) =>
      (
        (babelParse(`x = ${code}`).program.body[0] as t.ExpressionStatement)
          .expression as t.AssignmentExpression
      ).right;
    const [onclick, count] = [written('() => null'), written('5')];
    const template = getStoryContentTemplate(
      '<Button disabled={!args.onclick} total={args.count + 1} />',
      { onclick, count }
    );
    expect(template).toBe('<Button disabled={!⟦operand onclick⟧} total={⟦value count⟧ + 1} />');
    expect(fillTemplate(template!, { onclick: writtenArg('() => null'), count: 5 })).toBe(
      '<Button disabled={!(() => null)} total={5 + 1} />'
    );
  });

  it('reads an arg named with a space, as one word', () => {
    const template = getStoryContentTemplate(`<Button title={args['Button title']} />`);
    expect(template).toBe('<Button ⟦attr title %Button%20title⟧ />');
    expect(fillTemplate(template!, { 'Button title': 'Go on' })).toBe('<Button title="Go on" />');
  });

  it('keeps a write to an arg as written, with a hole at each read', () => {
    expect(
      getStoryContentTemplate('<Button onclick={() => (args.label = "x")}>{args.label}</Button>')
    ).toBe('<Button onclick={() => (args.label = "x")}>⟦text label⟧</Button>');
  });

  it('keeps a delete of an arg as written', () => {
    expect(getStoryContentTemplate('<Button onclick={() => delete args.label} n={args.n} />')).toBe(
      '<Button onclick={() => delete args.label} ⟦attr n n⟧ />'
    );
  });

  it('is undefined for args no hole stands for', () => {
    for (const code of [
      '<Button />',
      '<Button {args} />',
      '<Button data={args} />',
      '<Button label={args[name]} />',
      '<Input bind:value={args.value} />',
      '<Button onclick={() => args.count++} />',
      '<p>⟦text label⟧ {args.label}</p>',
      '<p>{unclosed</p>',
    ]) {
      expect(getStoryContentTemplate(code), code).toBeUndefined();
    }
  });
});
