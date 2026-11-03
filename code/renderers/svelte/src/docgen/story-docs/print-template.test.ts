import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

import { type ESTreeNode as Node, parseExpression, staticKey } from 'storybook/internal/csf-tools';

import { writtenArg } from 'storybook/internal/docs-tools';

import { fillTemplate } from '../../docs/fill-template.ts';
import { argCode, literalOf } from './build-story-docs.ts';
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

// The args a story is written with, as the preview fills a template with them.
const ownArgs = (written: Record<string, Node>) => {
  const code = argCode(written);
  return Object.fromEntries(
    Object.entries(written).map(([name, node]) => [
      name,
      Object.hasOwn(code, name) ? writtenArg(code[name]!) : literalOf(node)!.value,
    ])
  );
};

// Prints a template with values, and checks that the template with holes, filled with the same
// args, prints the same code.
const printChecked = (options: Parameters<typeof printTemplate>[0]) => {
  const printed = printTemplate(options);
  const template = printTemplate({ ...options, holes: true });
  expect(fillTemplate(template, ownArgs(options.args))).toBe(printed);
  return printed;
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

describe('printTemplate with holes', () => {
  const template = (code: string, source = '{}') =>
    printTemplate({ code, args: args(source), typescript: false, holes: true });

  it('prints a hole wherever it prints an arg', () => {
    expect(template('<Panel {...args} />', "{ label: 'Go' }")).toBe(
      "<Panel⟦spread 'label <%20 >⟧ />"
    );
    expect(template('<h1>{args.title}</h1>', "{ title: 'Save' }")).toBe(
      "<h1>⟦fragment title ' <%7B >%7D⟧</h1>"
    );
  });

  it('fills a spread with the args a control changed, past 50 characters one per line', () => {
    const filled = fillTemplate(template('<Panel {...args} />', "{ label: 'Go' }"), {
      label: 'A label long enough to wrap the spread',
      count: 3,
      onclick: undefined,
    });
    expect(filled).toBe(
      '<Panel\n  label="A label long enough to wrap the spread"\n  count={3}\n />'
    );
  });

  it('prints an arg the story does not set where a control sets it', () => {
    const code = '<Panel title={args.title}>{args.label}</Panel>';
    const written = template(code, "{ label: 'Go' }");
    expect(fillTemplate(written, { label: 'Go' })).toBe('<Panel title={args.title}>Go</Panel>');
    expect(fillTemplate(written, { label: 'Go', title: 'Hi' })).toBe(
      '<Panel title="Hi">Go</Panel>'
    );
  });

  it('prints the code an unchanged arg is written with, and a changed one as its value', () => {
    const written = template('<Button onclick={args.onclick} />', "{ onclick: () => alert('hi') }");
    // As next prints it: code that is no name, call or literal gets parentheses where a read stood.
    expect(fillTemplate(written, { onclick: writtenArg("() => alert('hi')") })).toBe(
      "<Button onclick={(() => alert('hi'))} />"
    );
    expect(fillTemplate(written, { onclick: 'go' })).toBe('<Button onclick="go" />');
  });
});
