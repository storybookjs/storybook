import { describe, expect, it } from 'vitest';

import React, { Fragment, forwardRef, memo } from 'react';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import { dedent } from 'ts-dedent';

import { fillTemplate } from './fill-template.ts';

const Icon = ({ size }: { size?: number }) => <svg width={size} />;

describe('fillTemplate', () => {
  it('spreads args as props', () => {
    expect(
      fillTemplate('const Primary = () => <Button {...args} />;', {
        primary: true,
        label: 'Click',
        disabled: false,
        size: 2,
      })
    ).toBe('const Primary = () => <Button primary label="Click" disabled={false} size={2} />;');
  });

  it('leaves unset args out', () => {
    expect(
      fillTemplate('const Primary = () => <Button {...args} />;', { label: undefined, icon: null })
    ).toBe('const Primary = () => <Button />;');
  });

  it('puts a long spread one prop per line, indented under the element', () => {
    expect(
      fillTemplate(
        dedent`
          const Primary = () => (
            <Wrapper>
              <Button {...args} />
            </Wrapper>
          );
        `,
        { primary: true, label: 'A long label value', size: 'large', backgroundColor: '#fff' }
      )
    ).toBe(dedent`
      const Primary = () => (
        <Wrapper>
          <Button
            primary
            label="A long label value"
            size="large"
            backgroundColor="#fff"
          />
        </Wrapper>
      );
    `);
  });

  it('keeps a spread written on its own line on its own lines', () => {
    expect(
      fillTemplate('<Button\n  {...args}\n  variant="solid"\n/>', { primary: true, label: 'Hi' })
    ).toBe('<Button\n  primary\n  label="Hi"\n  variant="solid"\n/>');
  });

  it('writes children between the tags, and closes the tag when there are none', () => {
    const template = 'const S = () => <Button {...args}>{args.children}</Button>;';
    expect(fillTemplate(template, { primary: true, children: 'Click me' })).toBe(
      'const S = () => <Button primary>Click me</Button>;'
    );
    expect(fillTemplate(template, { primary: true })).toBe('const S = () => <Button primary />;');
    expect(fillTemplate(template, { children: '' })).toBe('const S = () => <Button />;');
  });

  it('closes a long element with children on its own line', () => {
    expect(
      fillTemplate('<Button {...args}>{args.children}</Button>', {
        label: 'A long label value',
        size: 'large',
        backgroundColor: '#fff',
      })
    ).toBe('<Button\n  label="A long label value"\n  size="large"\n  backgroundColor="#fff"\n/>');
  });

  it('leaves out the props the element writes next to the spread', () => {
    expect(
      fillTemplate(
        'const S = () => <Button {...args/* omit: onClick, variant */} onClick={() => go()} variant="solid">Solid</Button>;',
        { variant: 'ghost', onClick: () => {}, size: 'small', children: 'Button' }
      )
    ).toBe(
      'const S = () => <Button size="small" onClick={() => go()} variant="solid">Solid</Button>;'
    );
  });

  it('spreads an object arg as its props', () => {
    expect(
      fillTemplate('<Input {...args.input} />', { input: { type: 'email', required: true } })
    ).toBe('<Input type="email" required />');
  });

  it('keeps the children of an object arg it spreads', () => {
    expect(
      fillTemplate('<Button {...args.buttonProps} />', {
        buttonProps: { label: 'x', children: 'Hi' },
      })
    ).toBe('<Button label="x" children="Hi" />');
  });

  it('leaves out an unset object arg it spreads', () => {
    expect(fillTemplate('<Input {...args.input} />', {})).toBe('<Input />');
    expect(fillTemplate('<Input\n  {...args.input}\n  type="email"\n/>', { input: null })).toBe(
      '<Input\n  type="email"\n/>'
    );
  });

  it('collects props that are not valid attribute names into a spread object', () => {
    expect(fillTemplate('<Button {...args} />', { 'aria label': 'x', label: 'Go' })).toBe(
      '<Button label="Go" {...{ "aria label": "x" }} />'
    );
  });

  it('fills single props and drops the ones whose arg is unset', () => {
    expect(
      fillTemplate(
        'const S = () => <Button label={args.label} hidden={args.hidden} disabled={args.disabled} />;',
        { label: 'Click', disabled: false }
      )
    ).toBe('const S = () => <Button label="Click" disabled={false} />;');
  });

  it('drops the line of an unset prop written on its own line', () => {
    expect(
      fillTemplate('<Button\n  label={args.label}\n  icon={args.icon}\n/>', { label: 'Hi' })
    ).toBe('<Button\n  label="Hi"\n/>');
  });

  it('keeps the structure of the story and fills in the values', () => {
    expect(
      fillTemplate(
        'const S = () => args.loading ? <Spinner /> : <List>{args.items.map((i) => <li>{i}</li>)}</List>;',
        { loading: true, items: ['a', 'b'] }
      )
    ).toBe(
      'const S = () => true ? <Spinner /> : <List>{["a", "b"].map((i) => <li>{i}</li>)}</List>;'
    );
  });

  it('keeps calls on a filled value as written', () => {
    expect(fillTemplate('<Button label={args.label.toUpperCase()} />', { label: 'go' })).toBe(
      '<Button label={"go".toUpperCase()} />'
    );
    expect(
      fillTemplate('<p>{args.count.toFixed(1)} {-args.delta}</p>', { count: 3, delta: -1 })
    ).toBe('<p>{(3).toFixed(1)} {-(-1)}</p>');
  });

  it('names a value it cannot print by its arg, not by the call on it', () => {
    const rows = Array.from({ length: 100 }, (_, id) => ({ id }));
    expect(fillTemplate('<List>{args.rows.map((row) => <Row {...row} />)}</List>', { rows })).toBe(
      '<List>{rows.map((row) => <Row {...row} />)}</List>'
    );
  });

  it('follows optional chaining and bracket access', () => {
    expect(
      fillTemplate('<Button label={args?.label} n={args.obj["a"]} first={args.list[0]} />', {
        label: 'X',
        obj: { a: 1 },
        list: ['one'],
      })
    ).toBe('<Button label="X" n={1} first="one" />');
  });

  it('fills children written after another element as a child', () => {
    expect(
      fillTemplate('<Card title={args.title}><Icon />{args.children}</Card>', { title: 'Yo' })
    ).toBe('<Card title="Yo"><Icon /></Card>');
    expect(fillTemplate('<Card><h1>Hi</h1>{args.children}</Card>', {})).toBe(
      '<Card><h1>Hi</h1></Card>'
    );
  });

  it('throws for a value it can only print as a name that is not an identifier', () => {
    expect(() => fillTemplate('<Button {...args} />', { 'data-click': () => {} })).toThrow(
      UnprintableArgError
    );
  });

  it('writes text children as text, and the rest as expressions', () => {
    expect(
      fillTemplate('<p>{args.text} {args.count} {args.html} {args.missing} {args.items}</p>', {
        text: 'Hello',
        count: 3,
        html: '<b>bold</b>',
        items: [{ id: 1 }],
      })
    ).toBe('<p>Hello 3 {"<b>bold</b>"}  {[{ id: 1 }]}</p>');
  });

  it('quotes strings that cannot be attribute strings', () => {
    expect(fillTemplate('<Button {...args} />', { label: 'Say "hi"', title: 'a\nb' })).toBe(
      String.raw`<Button label={"Say \"hi\""} title={"a\nb"} />`
    );
  });

  it('keeps special characters that attribute strings allow', () => {
    expect(fillTemplate('<Button {...args} />', { label: "<it's> & {x}" })).toBe(
      `<Button label="<it's> & {x}" />`
    );
  });

  it('quotes text that JSX would decode as an entity', () => {
    expect(
      fillTemplate('<Button {...args}>{args.children}</Button>', {
        label: 'a &amp; b',
        title: 'a & b',
        children: 'x &lt; y',
      })
    ).toBe('<Button label={"a &amp; b"} title="a & b">{"x &lt; y"}</Button>');
  });

  it('quotes text children with line breaks, which JSX would collapse', () => {
    expect(fillTemplate('<p>{args.text}</p>', { text: 'one\ntwo' })).toBe(
      String.raw`<p>{"one\ntwo"}</p>`
    );
  });

  it('prints a function as the arg it is passed as', () => {
    expect(
      fillTemplate('<Button {...args/* omit: onFocus */} onFocus={() => args.onFocus()} />', {
        onClick: () => {},
        onFocus: () => {},
      })
    ).toBe('<Button onClick={onClick} onFocus={() => onFocus()} />');
  });

  it('prints elements as JSX', () => {
    expect(
      fillTemplate('<Button {...args}>{args.children}</Button>', {
        icon: <Icon size={16} />,
        children: [<b key="b">Bold</b>, ' text'],
      })
    ).toBe('<Button icon={<Icon size={16} />}><b>Bold</b> text</Button>');
  });

  it('names memo, forwardRef and fragment elements', () => {
    const Memo = memo(function Card() {
      return null;
    });
    const Ref = forwardRef(function Field() {
      return null;
    });
    expect(
      fillTemplate('{args.a}{args.b}{args.c}', {
        a: <Memo />,
        b: <Ref />,
        c: (
          <Fragment>
            <i>x</i>
          </Fragment>
        ),
      })
    ).toBe('<Card /><Field /><><i>x</i></>');
  });

  it('prints objects, arrays and dates as literals', () => {
    expect(
      fillTemplate('<Chart {...args} />', {
        style: { color: 'red', 'z-index': 1 },
        data: [1, 2],
        from: new Date('2024-01-01T00:00:00.000Z'),
      })
    ).toBe(
      dedent`
        <Chart
          style={{ color: "red", "z-index": 1 }}
          data={[1, 2]}
          from={new Date("2024-01-01T00:00:00.000Z")}
        />
      `
    );
  });

  it('prints values too large to read as the arg name', () => {
    const rows = Array.from({ length: 100 }, (_, id) => ({ id, name: `Row ${id}` }));
    expect(fillTemplate('<Table {...args} />', { rows })).toBe('<Table rows={rows} />');
  });

  it('does not read a filled value as a template', () => {
    expect(
      fillTemplate('<Button label={args.label} title={args.title} />', {
        label: '{args.title}',
        title: 'args.label',
      })
    ).toBe('<Button label="{args.title}" title="args.label" />');
  });

  it('leaves names that only start with args, and template literals, alone', () => {
    expect(fillTemplate('<Table argsTable={argsTable} />', {})).toBe(
      '<Table argsTable={argsTable} />'
    );
    expect(fillTemplate('<p>{`${args.name}!`}</p>', { name: 'Ada' })).toBe('<p>{`${"Ada"}!`}</p>');
  });
});
