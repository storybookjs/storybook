import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { fillSnippetTemplate } from './fill-template.ts';

const element = (type: unknown) => ({ $$typeof: Symbol.for('react.element'), type, props: {} });

describe('fillSnippetTemplate', () => {
  it('spreads args as attributes', () => {
    expect(
      fillSnippetTemplate('const Primary = () => <Button {...args} />;', {
        primary: true,
        label: 'Click',
      })
    ).toBe('const Primary = () => <Button primary label="Click" />;');
  });

  it('leaves no stray space when there are no args', () => {
    expect(fillSnippetTemplate('const Primary = () => <Button {...args} />;', {})).toBe(
      'const Primary = () => <Button />;'
    );
  });

  it('puts long spreads one prop per line, indented like the element', () => {
    expect(
      fillSnippetTemplate(
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

  it('writes children used in the template as text, not as a prop', () => {
    expect(
      fillSnippetTemplate('const Primary = () => <Button {...args}>{args.children}</Button>;', {
        children: 'Click me',
        primary: true,
      })
    ).toBe('const Primary = () => <Button primary>Click me</Button>;');
  });

  it('fills single attributes and drops the ones whose arg is unset', () => {
    expect(
      fillSnippetTemplate(
        'const S = () => <Button label={args.label} hidden={args.hidden} disabled={args.disabled} />;',
        { label: 'Click', disabled: false }
      )
    ).toBe('const S = () => <Button label="Click" disabled={false} />;');
  });

  it('keeps the structure of the story and fills in the values', () => {
    expect(
      fillSnippetTemplate(
        'const S = () => args.loading ? <Spinner /> : <List>{args.items.map((i) => <li>{i}</li>)}</List>;',
        { loading: true, items: ['a', 'b'] }
      )
    ).toBe(
      'const S = () => true ? <Spinner /> : <List>{["a", "b"].map((i) => <li>{i}</li>)}</List>;'
    );
  });

  it('follows optional chaining and bracket access', () => {
    expect(
      fillSnippetTemplate('const S = () => <Button label={args?.label} n={args.obj["a"]} />;', {
        label: 'X',
        obj: { a: 1 },
      })
    ).toBe('const S = () => <Button label="X" n={1} />;');
  });

  it('leaves identifiers that merely start with args alone', () => {
    expect(fillSnippetTemplate('const S = () => <Table argsTable={argsTable} />;', {})).toBe(
      'const S = () => <Table argsTable={argsTable} />;'
    );
  });

  it('prints functions, elements, objects and arrays as code', () => {
    function Icon() {}
    const spy = Object.assign(() => {}, { getMockName: () => 'spy' });
    expect(
      fillSnippetTemplate('const S = () => <Button {...args} />;', {
        icon: element(Icon),
        onClick: spy,
        style: { color: 'red', 'z-index': 1 },
      })
    ).toBe(dedent`
      const S = () => <Button
        icon={<Icon />}
        onClick={() => {}}
        style={{ color: "red", "z-index": 1 }}
      />;
    `);
  });
});

describe('fillSnippetTemplate with written children', () => {
  it('leaves children out of a spread on an element that has its own', () => {
    expect(
      fillSnippetTemplate('const S = () => <Button {...args}>Solid</Button>;', {
        children: 'Button',
        primary: true,
      })
    ).toBe('const S = () => <Button primary>Solid</Button>;');
  });
});
