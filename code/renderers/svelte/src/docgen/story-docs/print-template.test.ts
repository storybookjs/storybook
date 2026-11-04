import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

import { type ESTreeNode as Node, parseExpression, staticKey } from 'storybook/internal/csf-tools';

import {
  type SnippetTemplate,
  fillTemplate,
  formatTemplate,
  printValue,
  stripHoles,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import { printHole } from '../../docs/print-hole.ts';
import type { SvelteHolePlace } from '../../snippet-values.ts';
import { type TemplateParameter, printTemplate } from './print-template.ts';

const args = (source: string): Record<string, Node> => {
  const object = parseExpression(source);
  if (object.type !== 'ObjectExpression') throw new Error('Expected an object literal');
  return Object.fromEntries(
    object.properties.flatMap((property) =>
      property.type === 'Property' ? [[staticKey(property)!, property.value]] : []
    )
  );
};

// Prints the snippet, and checks that its template prints it while no arg changes.
const printChecked = (options: Parameters<typeof printTemplate>[0]) => {
  const { snippet, template } = printTemplate(options);
  expect(template).toBeDefined();
  expect(stripHoles(template!)).toBe(snippet);
  return snippet;
};

const print = (code: string, source = '{}', typescript = false, parameter?: TemplateParameter) =>
  printChecked({ code, args: args(source), typescript, parameter });

describe('printTemplate', () => {
  it('spreads every arg, including the ones that equal a default', () => {
    expect(print('<Panel {...args} />', "{ count: 0, primary: false, label: 'args.count' }")).toBe(
      '<Panel count={0} primary={false} label="args.count" />'
    );
  });

  it('prints a mock as written', () => {
    expect(print('<Button {...args} />', "{ onclick: fn().mockName('onclick') }")).toBe(
      "<Button onclick={fn().mockName('onclick')} />"
    );
  });

  it('substitutes text and quoted attributes without adding quotes', () => {
    expect(
      print(
        '<Panel title="Title: {args.title}" count={args.count}><h1>{args.title}</h1></Panel>',
        "{ title: 'Save', count: 3 }"
      )
    ).toBe('<Panel title="Title: Save" count={3}><h1>Save</h1></Panel>');
  });

  it('prints a string arg that is the whole attribute value in quotes', () => {
    expect(print('<Panel title={args.title} />', "{ title: 'Save' }")).toBe(
      '<Panel title="Save" />'
    );
  });

  it('keeps an attribute in braces when quotes would change its value', () => {
    expect(
      print(
        '<Panel title={args.quote} label={args.empty} count={args.count} />',
        "{ quote: 'Say \"hi\"', empty: '', count: 3 }"
      )
    ).toBe("<Panel title={'Say \"hi\"'} label={''} count={3} />");
  });

  it('keeps strings that contain markup as expressions', () => {
    expect(print('<Panel>{args.label}</Panel>', '{ label: "<b>Save</b>" }')).toBe(
      '<Panel>{"<b>Save</b>"}</Panel>'
    );
  });

  it('prints one space when the spread has no args', () => {
    expect(print('<Button {...args} />')).toBe('<Button />');
  });

  it('removes the line that holds an empty spread', () => {
    expect(print('<Button\n  {...args}\n  primary\n/>')).toBe('<Button\n  primary\n/>');
  });

  it('prints expressions in spreads, attributes, text and quoted strings', () => {
    expect(
      print(
        '<Panel {...args} value={args.data} title="Rows: {args.data.length}">{args.data.length}</Panel>',
        '{ data: rows.filter((row) => row.enabled) }'
      )
    ).toBe(
      '<Panel data={rows.filter((row) => row.enabled)} value={rows.filter((row) => row.enabled)} title="Rows: {rows.filter((row) => row.enabled).length}">{rows.filter((row) => row.enabled).length}</Panel>'
    );
  });

  it('reads static members of an object arg', () => {
    expect(print('<p>{args.user.name}</p>', "{ user: { name: 'Jane' } }")).toBe('<p>Jane</p>');
  });

  it('applies explicit attributes separately for each spread element', () => {
    expect(
      print(
        '<Panel {...args} label="Explicit" /><Panel label="Earlier" {...args} />',
        "{ label: 'From args', disabled: true }"
      )
    ).toBe('<Panel disabled label="Explicit" /><Panel label="From args" disabled />');
  });

  it.each([
    ['<Button>{"args.label"}</Button>', '<Button>{"args.label"}</Button>'],
    ['<!-- args.label --><Button {... args} />', '<!-- args.label --><Button label="Hello" />'],
    ['<Button>{args["label"]}</Button>', '<Button>Hello</Button>'],
    [
      '<Button>{(() => { const args = { label: "local" }; return args.label; })()}</Button>',
      '<Button>{(() => { const args = { label: "local" }; return args.label; })()}</Button>',
    ],
  ])('changes only reads of the story args in %s', (code, expected) => {
    const snippet = print(code, "{ label: 'Hello' }");
    expect(snippet).toBe(expected);
    expect(() => parse(snippet, { modern: true })).not.toThrow();
  });

  it.each([
    ['{#if args.enabled}<Button />{/if}', '{ enabled: true }', '{#if true}<Button />{/if}'],
    [
      '<Button {...args}>{args.children}</Button>',
      "{ children: 'Hello' }",
      '<Button>Hello</Button>',
    ],
  ])('handles expression and binding contexts in %s', (code, source, expected) => {
    const snippet = print(code, source);
    expect(snippet).toBe(expected);
    expect(() => parse(snippet, { modern: true })).not.toThrow();
  });

  it('keeps source offsets in expressions indented with tabs', () => {
    const snippet = print(
      '<Markdown\n\t{...wrapProps({\n\t\theight: args.height,\n\t\t...args\n\t})}\n/>',
      '{ height: 20 }'
    );
    expect(snippet).toContain('height: 20,');
    expect(snippet).toContain('...args\n\t})}');
    expect(() => parse(snippet, { modern: true })).not.toThrow();
  });

  it('reads TypeScript in the markup of a TypeScript story file', () => {
    const snippet = print('<Button label={args.label as string} />', "{ label: 'Save' }", true);
    expect(snippet).toBe("<Button label={'Save' as string} />");
  });

  it('wraps a substituted value that would change the meaning of the expression around it', () => {
    expect(print('<Counter value={-args.n} />', '{ n: -5 }')).toBe('<Counter value={-(-5)} />');
    expect(print('<Button onclick={() => args.onClick()} />', '{ onClick: () => alert(1) }')).toBe(
      '<Button onclick={() => (() => alert(1))()} />'
    );
  });

  it('reads the args through a renamed template parameter', () => {
    expect(
      print('<Button {...props} title={props.label} />', "{ label: 'Save' }", false, {
        name: 'props',
        aliases: {},
      })
    ).toBe('<Button label="Save" title="Save" />');
  });

  it('reads the args that a template parameter destructures', () => {
    expect(
      print(
        '<Button {...rest} title="{icon} {label}">{children}</Button>',
        "{ icon: '★', label: 'Save', children: 'Go', primary: true }",
        false,
        { name: 'rest', aliases: { icon: 'icon', label: 'label', children: 'children' } }
      )
    ).toBe('<Button primary title="★ Save">Go</Button>');
  });

  it('prints undefined for an arg the story does not set, when all args are known', () => {
    const printComplete = (code: string, source: string, parameter?: TemplateParameter) =>
      printChecked({ code, args: args(source), typescript: false, parameter, argsComplete: true });

    expect(
      printComplete(
        '<div style:background={args?.variant === "ghost" ? "blue" : null}>{args.text}{args.icon.name}</div>',
        "{ text: 'Hi' }"
      )
    ).toBe('<div style:background={undefined === "ghost" ? "blue" : null}>Hi{undefined}</div>');
    expect(
      printComplete('<Toolbar ariaLabel={ariaLabel} />', '{}', {
        aliases: { ariaLabel: 'ariaLabel' },
      })
    ).toBe('<Toolbar ariaLabel={undefined} />');
    expect(printComplete('<Input bind:value={args.value} />', '{}')).toBe(
      '<Input bind:value={args.value} />'
    );
  });

  it('keeps the read of an arg the story does not set, when some args are not known', () => {
    expect(print('<Layout>{args.footer}</Layout>', "{ text: 'Hi' }")).toBe(
      '<Layout>{args.footer}</Layout>'
    );
  });

  it('wraps an object literal that would read as a block body', () => {
    expect(print('<Button onclick={() => args.o} />', '{ o: { a: 1 } }')).toBe(
      '<Button onclick={() => ({ a: 1 })} />'
    );
  });

  it('keeps braces in a quoted attribute as text', () => {
    expect(print('<Button title="{args.t}" />', "{ t: 'a {b} c' }")).toBe(
      '<Button title="{\'a {b} c\'}" />'
    );
  });

  it('writes the long form of a directive shorthand that reads a destructured arg', () => {
    expect(
      print('<Button class:active {...rest} />', '{ active: true }', false, {
        name: 'rest',
        aliases: { active: 'active' },
      })
    ).toBe('<Button class:active={true} />');
  });

  it('writes the long form of an attribute shorthand that reads a destructured arg', () => {
    expect(
      print('<Button {label} />', "{ label: 'Save' }", false, {
        name: 'rest',
        aliases: { label: 'label' },
      })
    ).toBe('<Button label="Save" />');
  });

  it('writes the long form of a shorthand whose arg is written as the same name', () => {
    expect(
      print('<Button {label} class:active />', '{ label: label, active: active }', false, {
        name: 'rest',
        aliases: { label: 'label', active: 'active' },
      })
    ).toBe('<Button label={label} class:active={active} />');
  });

  it('keeps the name of a shorthand property that reads a destructured arg', () => {
    expect(
      print('<Button value={{ label }} />', "{ label: 'Save' }", false, {
        name: 'rest',
        aliases: { label: 'label' },
      })
    ).toBe("<Button value={{ label: 'Save' }} />");
  });

  it('keeps reading the args that a block does not shadow', () => {
    expect(
      print(
        '{#each items as label}<Button value={rest.x} />{/each}',
        "{ x: 1, label: 'L' }",
        false,
        {
          name: 'rest',
          aliases: { label: 'label' },
        }
      )
    ).toBe('{#each items as label}<Button value={1} />{/each}');
  });

  it.each([
    ['a later spread', '{ o: { a: 1, ...defaults } }', '({ a: 1, ...defaults }).a'],
    ['a later computed key', '{ o: { a: 1, [key]: 2 } }', '({ a: 1, [key]: 2 }).a'],
    ['a getter', '{ o: { get a() { return 1; } } }', '({ get a() { return 1; } }).a'],
    ['a method', '{ o: { a() { return 1; } } }', '({ a() { return 1; } }).a'],
  ])('keeps the member access when %s may decide the member', (_, source, expected) => {
    const snippet = print('<Button value={args.o.a} />', source);
    expect(snippet).toBe(`<Button value={${expected}} />`);
    expect(() => parse(snippet, { modern: true })).not.toThrow();
  });

  it('keeps the index access after an array spread', () => {
    expect(print('<Button value={args.o[1]} />', '{ o: [...items, 1] }')).toBe(
      '<Button value={[...items, 1]["1"]} />'
    );
  });

  it('reads the args in an attachment', () => {
    expect(print('<div {@attach tooltip(args.tip)}></div>', "{ tip: 'Save' }")).toBe(
      "<div {@attach tooltip('Save')}></div>"
    );
  });

  it('keeps the target of a binding', () => {
    expect(print('<Input bind:value={args.value} />', "{ value: 'Hello' }")).toBe(
      '<Input bind:value={args.value} />'
    );
  });
});

describe('printTemplate template', () => {
  const template = (code: string, source = '{}', parameter?: TemplateParameter) =>
    printTemplate({ code, args: args(source), typescript: false, parameter }).template!;
  const fill = (written: SnippetTemplate<SvelteHolePlace>, initialArgs: Args, unmappedArgs: Args) =>
    fillTemplate(written, { initialArgs, unmappedArgs }, printHole);

  it('wraps each place an arg prints in a hole that holds what it prints there', () => {
    expect(formatTemplate(template('<Panel {...args} />', "{ label: 'Go' }"))).toBe(
      '<Panel⟦prop label ~" "⟫ label="Go"⟧⟦props * except=["label"] separator=" " ~" "⟫⟧ />'
    );
    expect(formatTemplate(template('<h1>{args.title}</h1>', "{ title: 'Save' }"))).toBe(
      '<h1>⟦fragment title before="{" after="}"⟫Save⟧</h1>'
    );
  });

  it('names the attribute or property of a hole only where it is not its arg', () => {
    const parameter = { aliases: { label: 'label', text: 'label' } };
    expect(formatTemplate(template('<Panel title={args.label} />', "{ label: 'Go' }"))).toBe(
      '<Panel ⟦attrvalue label name="title" before="title={" after="}"⟫title="Go"⟧ />'
    );
    expect(formatTemplate(template('<Panel {label} />', "{ label: 'Go' }", parameter))).toBe(
      '<Panel ⟦attrvalue label before="label={" after="}"⟫label="Go"⟧ />'
    );
    const properties = template('<Panel data={{ label, text }} />', "{ label: 'Go' }", parameter);
    expect(formatTemplate(properties)).toBe(
      `<Panel data={{ ⟦property label⟫label: 'Go'⟧, ⟦property label name="text"⟫text: 'Go'⟧ }} />`
    );
    expect(fill(properties, { label: 'Go' }, { label: 'Stop' })).toBe(
      `<Panel data={{ label: "Stop", text: "Stop" }} />`
    );
  });

  it('adds the args a control adds after the props of the spread, but those the element writes', () => {
    const written = template('<Panel {...args} title="T" />', "{ label: 'Go' }");
    expect(fill(written, { label: 'Go' }, { label: 'Go', count: 3, title: 'X' })).toBe(
      '<Panel label="Go" count={3} title="T" />'
    );
    const wrapped = template(
      '<Panel {...args} />',
      "{ label: 'A label that is long enough to wrap the spread' }"
    );
    const initialArgs = { label: 'A label that is long enough to wrap the spread' };
    expect(fill(wrapped, initialArgs, { ...initialArgs, count: 3, size: 'sm' })).toBe(
      '<Panel\n  label="A label that is long enough to wrap the spread"\n  count={3}\n  size="sm"\n />'
    );
  });

  it('passes an arg the spread passes, also where another place reads it', () => {
    const written = template('<Panel {...args}>{args.label}</Panel>', "{ size: 'sm' }");
    expect(fill(written, { size: 'sm' }, { size: 'sm', label: 'Go' })).toBe(
      '<Panel size="sm" label="Go">Go</Panel>'
    );
  });

  it('adds the args a control adds on the line of a spread that passes none', () => {
    const written = template('<Button\n  {...args}\n  primary\n/>');
    expect(stripHoles(written)).toBe('<Button\n  primary\n/>');
    expect(fill(written, {}, { label: 'Go', size: 'sm' })).toBe(
      '<Button\n  label="Go"\n  size="sm"\n  primary\n/>'
    );
    expect(fill(template('<Button {...args} />'), {}, { label: 'Go' })).toBe(
      '<Button label="Go" />'
    );
  });

  it('leaves out a prop a control clears', () => {
    const written = template('<Panel {...args} />', "{ label: 'Go', count: 3 }");
    expect(fill(written, { label: 'Go', count: 3 }, { count: 3 })).toBe('<Panel count={3} />');
  });

  it('keeps the read of an arg the story does not set until a control sets it', () => {
    const written = template('<Panel title={args.title}>{args.label}</Panel>', "{ label: 'Go' }");
    expect(fill(written, { label: 'Go' }, { label: 'Stop' })).toBe(
      '<Panel title={args.title}>Stop</Panel>'
    );
    expect(fill(written, { label: 'Go' }, { label: 'Go', title: 'Hi' })).toBe(
      '<Panel title="Hi">Go</Panel>'
    );
  });

  it('keeps an arg written as code while it is unchanged', () => {
    const written = template(
      '<Button onclick={args.onclick} label={args.label} />',
      "{ onclick: () => alert('hi'), label: 'Go' }"
    );
    const initialArgs = { onclick: () => {}, label: 'Go' };
    expect(fill(written, initialArgs, { ...initialArgs, label: 'Stop' })).toBe(
      '<Button onclick={(() => alert(\'hi\'))} label="Stop" />'
    );
  });

  it('writes the long form of a directive shorthand once a control sets its arg', () => {
    const written = template('<div class:active>{active}</div>', "{ label: 'Go' }", {
      aliases: { active: 'active' },
    });
    expect(stripHoles(written)).toBe('<div class:active>{active}</div>');
    expect(fill(written, {}, { active: true })).toBe('<div class:active={true}>{true}</div>');
  });

  it('writes the holes of markup that holds private-use characters', () => {
    const written = template(
      '<Panel title="\uE000\uE001\uE002">{args.label}</Panel>',
      "{ label: 'Go' }"
    );
    expect(stripHoles(written)).toBe('<Panel title="\uE000\uE001\uE002">Go</Panel>');
    expect(fill(written, { label: 'Go' }, { label: 'Stop' })).toBe(
      '<Panel title="\uE000\uE001\uE002">Stop</Panel>'
    );
  });

  it('writes the holes of an arg whose escaped value prints a private-use character', () => {
    const written = template('<Panel title={args.title} />', "{ title: '\\uE000x' }");
    expect(stripHoles(written)).toBe('<Panel title="\uE000x" />');
    expect(fill(written, { title: '\uE000x' }, { title: 'y' })).toBe('<Panel title="y" />');
  });

  it.each([
    '<p>{args.user.name}</p>',
    '<Panel title={args.user.name} />',
    '<Panel title="By {args.user.name}" onclick={() => greet(args.user.name)} />',
    '<p>{args.user.tags.length}</p>',
  ])('prints a read of a member of an arg in %j as a story that writes the arg', (code) => {
    const jane = { name: 'Jane', tags: ['a'] };
    const written = template(code, "{ user: { name: 'Jane', tags: ['a'] } }");
    for (const user of [{ name: 'John', tags: ['a', 'b'] }, { tags: [] }, 'Jane', undefined]) {
      const source = `{ user: ${printValue(user, 'user')} }`;
      const story = printTemplate({ code, args: args(source), typescript: false });
      expect(fill(written, { user: jane }, { user }), JSON.stringify(user)).toBe(story.snippet);
    }
  });

  it('prints an attribute a later spread writes over as the spread prints it', () => {
    const written = template('<Panel title={heading} {...args} />', "{ label: 'Go' }");
    expect(fill(written, { label: 'Go' }, { label: 'Go', title: 'Hi' })).toBe(
      '<Panel title="Hi" label="Go" />'
    );
  });

  it('cannot follow the arg an attribute names that reads other args before a spread', () => {
    const written = template('<Panel title={args.label} {...args} />', "{ label: 'Go' }");
    expect(stripHoles(written)).toBe('<Panel title="Go" label="Go" />');
    expect(fill(written, { label: 'Go' }, { label: 'Stop' })).toBe(
      '<Panel title="Stop" label="Stop" />'
    );
    expect(() => fill(written, { label: 'Go' }, { label: 'Go', title: 'Hi' })).toThrow(
      'The snippet cannot show the current value of the `title` arg.'
    );
    const own = template('<Panel title={args.title} {...args} />', "{ label: 'Go' }");
    expect(fill(own, { label: 'Go' }, { label: 'Go', title: 'Hi' })).toBe(
      '<Panel title="Hi" label="Go" />'
    );
  });
});
