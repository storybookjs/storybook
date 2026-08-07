import { describe, expect, it } from 'vitest';

import { recast, types as t } from 'storybook/internal/babel';

import { dedent } from 'ts-dedent';

import { loadCsf } from '../CsfFile.ts';
import { normalizeStoryDeclaration } from './normalize-story.ts';

const parse = (code: string) => {
  return loadCsf(code, { makeTitle: (title) => title ?? 'title' }).parse();
};

const normalize = (code: string, exportName = 'A') => {
  return normalizeStoryDeclaration(parse(code)._storyDeclarationPath[exportName]);
};

const printedShape = (code: string) => {
  const normalized = normalize(code);
  return {
    // Recast may emit CRLF on Windows; keep assertions LF-stable across OSes.
    code: recast.print(normalized.path.node).code.replace(/\r\n/g, '\n'),
    type: normalized.type,
  };
};

describe('normalizeStoryDeclaration', () => {
  it('normalizes CSF3 object stories to config', () => {
    expect(
      printedShape(dedent`
        type Story = { args?: Record<string, unknown> };
        export default { title: 'Button' };
        export const A: Story = { args: {} };
      `)
    ).toMatchInlineSnapshot(`
      {
        "code": "{ args: {} }",
        "type": "config",
      }
    `);
  });

  it('unwraps satisfies and as expressions to config', () => {
    expect(
      printedShape(dedent`
        type Story = { args?: Record<string, unknown> };
        export default { title: 'Button' };
        export const A = { args: {} } satisfies Story;
      `)
    ).toEqual({
      code: '{ args: {} }',
      type: 'config',
    });
    expect(
      printedShape(dedent`
        type Story = { args?: Record<string, unknown> };
        export default { title: 'Button' };
        export const A = { args: {} } as Story;
      `)
    ).toEqual({
      code: '{ args: {} }',
      type: 'config',
    });
  });

  it('unwraps the config argument from CSF4 factory stories', () => {
    expect(
      printedShape(dedent`
        import { config } from '#.storybook/preview';
        const meta = config.meta({ title: 'Button' });
        export const A = meta.story({ args: {} });
      `)
    ).toMatchInlineSnapshot(`
      {
        "code": "{ args: {} }",
        "type": "config",
      }
    `);
  });

  it('normalizes empty CSF4 factory calls to emptyConfig', () => {
    expect(
      printedShape(dedent`
        import { config } from '#.storybook/preview';
        const meta = config.meta({ title: 'Button' });
        export const A = meta.story();
      `)
    ).toMatchInlineSnapshot(`
      {
        "code": "meta.story()",
        "type": "emptyConfig",
      }
    `);
  });

  it('resolves CSF2 Template.bind({}) to a local const arrow function', () => {
    expect(
      printedShape(dedent`
        export default { title: 'Button' };
        const Template = (args) => args;
        export const A = Template.bind({});
      `)
    ).toMatchInlineSnapshot(`
      {
        "code": "(args) => args",
        "type": "fn",
      }
    `);
  });

  it('resolves CSF2 Template.bind({}) to a function declaration', () => {
    expect(
      printedShape(dedent`
        export default { title: 'Button' };
        function Template(args) {
          return args;
        }
        export const A = Template.bind({});
      `)
    ).toEqual({
      code: 'function Template(args) {\n  return args;\n}',
      type: 'fn',
    });
  });

  it('normalizes plain arrow function story exports to fn', () => {
    const normalized = normalize(dedent`
      export default { title: 'Button' };
      export const A = (args) => args;
    `);

    expect(normalized.type).toBe('fn');
    expect(t.isArrowFunctionExpression(normalized.path.node)).toBe(true);
  });

  it('throws for factory calls with more than one argument', () => {
    expect(() =>
      normalize(dedent`
        import { config } from '#.storybook/preview';
        const meta = config.meta({ title: 'Button' });
        export const A = meta.story({}, {});
      `)
    ).toThrow('Could not evaluate story expression');
  });

  it('throws when a story is not a factory, function, or object expression', () => {
    expect(() =>
      normalize(dedent`
        export default { title: 'Button' };
        export const A = 'not a story shape';
      `)
    ).toThrow('Expected story to be csf factory, function or an object expression');
  });
});
