import { describe, expect, it } from 'vitest';
import { dedent } from 'ts-dedent';

import { fillTemplate } from '../../../../docs/fill-template.ts';
import { getStoryContentTemplate } from './template.ts';

describe(getStoryContentTemplate.name, () => {
  it('marks a spread as the props the element does not write itself', () => {
    expect(getStoryContentTemplate('<Button {...args} />')).toBe('<Button⟦props⟧ />');
    expect(getStoryContentTemplate('<Button {...args} onclick={handleClick}>Go</Button>')).toBe(
      '<Button⟦props -onclick -children⟧ onclick={handleClick}>Go</Button>'
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
      "<Button⟦attr label label⟧
        size="small"
      >
        ⟦text children⟧
        {#if ⟦value loading⟧}…{/if}
      </Button>"
    `);
    expect(fillTemplate(template!, { label: 'Go', children: 'Save', loading: true }))
      .toMatchInlineSnapshot(`
        "<Button label="Go"
          size="small"
        >
          Save
          {#if true}…{/if}
        </Button>"
      `);
  });

  it('leaves out of a spread the props the element writes itself', () => {
    expect(getStoryContentTemplate('<Input bind:value size="sm" {...args} />')).toBe(
      '<Input bind:value size="sm"⟦props -value -size⟧ />'
    );
  });

  it('is undefined for args no hole stands for', () => {
    for (const code of [
      '<Button />',
      '<Button {args} />',
      '<Button data={args} />',
      '<Button label={args[name]} />',
      '<p>⟦text label⟧ {args.label}</p>',
      '<p>{unclosed</p>',
    ]) {
      expect(getStoryContentTemplate(code), code).toBeUndefined();
    }
  });
});
