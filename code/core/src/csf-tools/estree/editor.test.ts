import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { loadCsf, printCsf } from '../CsfFile.ts';
import type { E } from './ast.ts';
import { parseModule } from './ast.ts';
import {
  SourceEditor,
  appendToList,
  arrayList,
  reindent,
  removeFromList,
  removeStatement,
  withParentheses,
} from './editor.ts';

const parse = (source: string, fileName?: string) =>
  loadCsf(source, { fileName, makeTitle: (title) => title ?? 'title' }).parse();

const defaultExportArray = (editor: SourceEditor) => {
  const statement = editor.program.body[0] as E.ExportDefaultDeclaration;
  const object = statement.declaration as E.ObjectExpression;
  return (object.properties[0] as E.ObjectProperty).value as E.ArrayExpression;
};

describe('parseModule', () => {
  it('parses .ts-only syntax when no file name picks the grammar', () => {
    expect(() => parseModule('const id = <T>(x: T) => x;')).not.toThrow();
    expect(() => parseModule('const size = <number>value;')).not.toThrow();
  });

  it('reports the error of the parse that got further', () => {
    expect(() => parseModule('const id = <T>(x: T) => x;\nconst z = ;')).toThrow('(2:10)');
  });

  it('rejects duplicate declarations like Babel did', () => {
    expect(() => parseModule('export const A = {};\nexport const A = { args: {} };')).toThrow(
      'already been declared'
    );
  });

  it('names Flow when a @flow file fails to parse', () => {
    expect(() => parseModule('// @flow\nconst x: { +readOnly: number } = {};')).toThrow(
      'Flow syntax is no longer supported'
    );
  });
});

describe('reindent', () => {
  it('re-indents code lines only', () => {
    expect(reindent('{\n  a: 1,\n}', '', '    ')).toBe('{\n      a: 1,\n    }');
    expect(reindent('{\n    a: 1,\n  }', '  ', '')).toBe('{\n  a: 1,\n}');
  });

  it('leaves the lines of template literals and continued strings alone', () => {
    expect(reindent('{\n  code: `line1\nline2`,\n}', '', '  ')).toBe(
      '{\n    code: `line1\nline2`,\n  }'
    );
    expect(reindent('{\n  code: `${a}\nb`,\n}', '', '  ')).toBe('{\n    code: `${a}\nb`,\n  }');
    expect(reindent("{\n  text: 'first\\\nsecond',\n}", '', '  ')).toBe(
      "{\n    text: 'first\\\nsecond',\n  }"
    );
  });

  it('re-indents code inside template expressions', () => {
    expect(reindent('`${\nfn()\n}`', '', '  ')).toBe('`${\n  fn()\n  }`');
  });
});

describe('withParentheses', () => {
  it('widens a span over the parentheses wrapped around it', () => {
    const code = '[ ((a ? 1 : 2)) ]';
    expect(withParentheses(code, { start: 4, end: 13 })).toEqual({ start: 2, end: 15 });
    expect(withParentheses(code, { start: 4, end: 13 }, 3, 14)).toEqual({ start: 3, end: 14 });
    expect(withParentheses(code, { start: 6, end: 7 })).toEqual({ start: 6, end: 7 });
  });

  it('appends after a parenthesized last element and removes it whole', () => {
    const editor = new SourceEditor(`export default { addons: [(cond ? 'a' : 'c')] };`);
    appendToList(editor, arrayList(editor, defaultExportArray(editor)), [`'b'`], '');
    expect(editor.toString()).toBe(`export default { addons: [(cond ? 'a' : 'c'), 'b'] };`);

    const removal = new SourceEditor(`export default { addons: ['b', (cond ? 'a' : 'c')] };`);
    const array = defaultExportArray(removal);
    removeFromList(removal, arrayList(removal, array), [array.elements[1]!]);
    expect(removal.toString()).toBe(`export default { addons: ['b'] };`);
  });
});

describe('removeStatement', () => {
  it('removes the leading comments with the statement', () => {
    const editor = new SourceEditor(dedent`
      import a from 'a';

      /** Shared template */
      const Template = () => null;
      // @ts-expect-error
      export const A = Template;
    `);
    removeStatement(editor, editor.program.body[1]);
    removeStatement(editor, editor.program.body[2]);
    expect(editor.toString()).toBe(`import a from 'a';\n\n`);
  });

  it('keeps the file header when the first statement is removed', () => {
    const editor = new SourceEditor(dedent`
      /* license */
      // @ts-expect-error
      const a = 1;
      const b = 2;
    `);
    removeStatement(editor, editor.program.body[0]);
    expect(editor.toString()).toBe(`/* license */\nconst b = 2;`);
  });
});

describe('line endings', () => {
  it('writes inserted text with the line ending of the file', () => {
    const csf = parse('export default {\r\n  title: "A",\r\n};\r\n');
    const [meta] = csf.objects({ stories: false });
    meta.set(['parameters', 'layout'], 'centered');
    expect(csf._editor.toString()).toBe(
      'export default {\r\n  title: "A",\r\n  parameters: { layout: "centered" },\r\n};\r\n'
    );
  });
});

describe('multi-line members', () => {
  it('moves a member that spans several lines without touching its value', () => {
    const csf = parse(dedent`
      export default {
        parameters: {
          a11y: {
            test: 'todo',
          },
        },
      };
    `);
    const [meta] = csf.objects({ stories: false });
    expect(meta.move(['parameters', 'a11y'], ['globals', 'a11y'])).toEqual({
      ok: true,
      changed: true,
    });
    expect(printCsf(csf).code).toBe(dedent`
      export default {
        globals: {
          a11y: {
            test: 'todo',
          },
        },
      };
    `);
  });

  it('groups multi-line members into an existing object', () => {
    const csf = parse(dedent`
      export default {
        layout: {
          existing: true,
        },
        showNav: {
          value: false,
        },
      };
    `);
    const [meta] = csf.objects({ stories: false });
    expect(meta.group(['layout'], ['showNav'])).toEqual({ ok: true, changed: true });
    expect(meta.getValue(['layout', 'showNav', 'value'])).toBe(false);
    expect(printCsf(csf).code).toContain(`showNav: {\n      value: false,\n    },`);
  });

  it('keeps the value of a template literal set into a multi-line object', () => {
    const csf = parse('export default {\n  parameters: {\n    a: 1,\n  },\n};');
    const [meta] = csf.objects({ stories: false });
    meta.set(['parameters', 'code'], { code: 'line1\nline2' });
    const [again] = parse(printCsf(csf).code).objects({ stories: false });
    expect(again.getValue(['parameters', 'code', 'code'])).toBe('line1\nline2');
  });
});
