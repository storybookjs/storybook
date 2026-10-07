import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { loadCsf } from '../CsfFile.ts';
import { textOf } from '../estree/ast.ts';
import { normalizeStoryDeclaration } from './normalize-story.ts';

const parse = (code: string) => {
  return loadCsf(code, { makeTitle: (title) => title ?? 'title' }).parse();
};

const normalize = (code: string, exportName = 'A') => {
  const csf = parse(code);
  csf._editor.parentOf(csf._program);
  return normalizeStoryDeclaration(csf._storyExports[exportName], csf._editor);
};

const printedShape = (code: string) => {
  const normalized = normalize(code);
  return {
    code: textOf(normalized.node),
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

  it('rejects zero-argument calls that are not CSF factories', () => {
    expect(() =>
      normalize(dedent`
        export default { title: 'Button' };
        export const A = makeStory();
      `)
    ).toThrow('Expected story to be csf factory, function or an object expression');
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

  it('resolves CSF2 Template.bind() to its local template', () => {
    expect(
      printedShape(dedent`
        export default { title: 'Button' };
        const Template = (args) => args;
        export const A = Template.bind();
      `)
    ).toMatchInlineSnapshot(`
      {
        "code": "(args) => args",
        "type": "fn",
      }
    `);
  });

  it.each(["Template.bind({ role: 'button' })", "Template['bind']({})"])(
    'rejects non-canonical CSF2 bind initializer %s',
    (initializer) => {
      expect(() =>
        normalize(dedent`
          export default { title: 'Button' };
          const Template = (args) => args;
          export const A = ${initializer};
        `)
      ).toThrow('Expected story to be csf factory, function or an object expression');
    }
  );

  it('normalizes plain arrow function story exports to fn', () => {
    const normalized = normalize(dedent`
      export default { title: 'Button' };
      export const A = (args) => args;
    `);

    expect(normalized.type).toBe('fn');
    expect(normalized.node.type).toBe('ArrowFunctionExpression');
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
