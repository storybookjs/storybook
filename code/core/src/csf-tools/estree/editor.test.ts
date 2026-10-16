import { SourceMap as NodeSourceMap } from 'node:module';

import { describe, expect, it } from 'vitest';

import { decode, encode } from '@jridgewell/sourcemap-codec';
import MagicString from 'magic-string';
import { dedent } from 'ts-dedent';

import { loadCsf, printCsf } from '../CsfFile.ts';
import { parseExpression } from '../CsfObject.ts';
import type { E } from './ast.ts';
import { parseModule } from './ast.ts';
import {
  SourceEditor,
  appendToList,
  arrayList,
  printMembers,
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

  it('does not mistake a regex backtick or JSX text for a template', () => {
    expect(reindent('{\n    a: /`/.test(s),\n    b: `x\n    y`,\n  }', '  ', '')).toBe(
      '{\n  a: /`/.test(s),\n  b: `x\n    y`,\n}'
    );
    expect(reindent("<p>\n    Don't\n    stop\n  </p>", '  ', '')).toBe(
      "<p>\n  Don't\n  stop\n</p>"
    );
    expect(reindent("{\n    text: 'first\\\nsecond',\n  }", '  ', '')).toBe(
      "{\n  text: 'first\\\nsecond',\n}"
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

  it('skips the comments between the parentheses and the element', () => {
    const editor = new SourceEditor(`export default { addons: [(/* c */ cond ? 'a' : 'c')] };`);
    appendToList(editor, arrayList(editor, defaultExportArray(editor)), [`'b'`], '');
    expect(editor.toString()).toBe(`export default { addons: [(/* c */ cond ? 'a' : 'c'), 'b'] };`);

    const removal = new SourceEditor(
      `export default { addons: [(/* c */ cond ? 'a' : 'c'), 'b'] };`
    );
    const array = defaultExportArray(removal);
    removeFromList(removal, arrayList(removal, array), [array.elements[1]!]);
    expect(removal.toString()).toBe(`export default { addons: [(/* c */ cond ? 'a' : 'c')] };`);

    const after = new SourceEditor(`export default { addons: [(x /* after */)] };`);
    appendToList(after, arrayList(after, defaultExportArray(after)), [`'b'`], '');
    expect(after.toString()).toBe(`export default { addons: [(x /* after */), 'b'] };`);

    // The list spans lines because of the comment, so the item lands on its own line.
    const line = new SourceEditor(`export default { addons: [(x // after\n)] };`);
    appendToList(line, arrayList(line, defaultExportArray(line)), [`'b'`], '');
    expect(line.toString()).toBe(`export default { addons: [(x // after\n),\n'b'] };`);
  });
});

describe('array holes', () => {
  it('keeps leading holes when appending to and emptying an array', () => {
    const editor = new SourceEditor(`export default { addons: [, 'a'] };`);
    appendToList(editor, arrayList(editor, defaultExportArray(editor)), [`'b'`], '');
    expect(editor.toString()).toBe(`export default { addons: [, 'a', 'b'] };`);

    const removal = new SourceEditor(`export default { addons: [, 'a'] };`);
    const array = defaultExportArray(removal);
    removeFromList(removal, arrayList(removal, array), [array.elements[1]!]);
    expect(removal.toString()).toBe(`export default { addons: [,] };`);
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
    expect(editor.toString()).toBe(`import a from 'a';\n`);
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

describe('parenthesized default exports', () => {
  it('hoists an inline meta without breaking its parentheses', () => {
    const csf = loadCsf(`export default ({ title: 'X' } satisfies Meta);\nexport const A = {};`, {
      transformInlineMeta: true,
      makeTitle: (title) => title ?? 'title',
    }).parse();
    expect(printCsf(csf).code).toBe(
      `const _meta = ({ title: 'X' } satisfies Meta);\nexport default _meta;\nexport const A = {};`
    );
  });

  it('hoists an inline meta with comments between the keywords', () => {
    const csf = loadCsf(`export /* a */ default // b\n { title: 'X' };\nexport const A = {};`, {
      transformInlineMeta: true,
      makeTitle: (title) => title ?? 'title',
    }).parse();
    expect(printCsf(csf).code).toBe(
      `const _meta = { title: 'X' };\nexport default _meta;\nexport const A = {};`
    );
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

  it('keeps a template literal when grouping it into a new key', () => {
    const csf = parse('export default {\n  previewHead: `<style>\n.a {}\n</style>`,\n  b: 1,\n};');
    const [meta] = csf.objects({ stories: false });
    expect(meta.group(['ui'], ['previewHead'])).toEqual({ ok: true, changed: true });
    expect(printCsf(csf).code).toBe(
      'export default {\n  ui: {\n    previewHead: `<style>\n.a {}\n</style>`,\n  },\n  b: 1,\n};'
    );
    const [again] = parse(printCsf(csf).code).objects({ stories: false });
    expect(again.getValue(['ui', 'previewHead'])).toBe('<style>\n.a {}\n</style>');
  });

  it('keeps a template literal set into a missing parent', () => {
    const csf = parse('export default {\n  parameters: {\n    a: 1,\n  },\n};');
    const [meta] = csf.objects({ stories: false });
    meta.set(['globals', 'code'], parseExpression('`line1\nline2`'));
    expect(printCsf(csf).code).toBe(
      'export default {\n  parameters: {\n    a: 1,\n  },\n  globals: {\n    code: `line1\nline2`,\n  },\n};'
    );
    const [again] = parse(printCsf(csf).code).objects({ stories: false });
    expect(again.getValue(['globals', 'code'])).toBe('line1\nline2');
  });

  it('keeps a template literal moved into a missing parent', () => {
    const csf = parse('export default {\n  parameters: {\n    code: `line1\nline2`,\n  },\n};');
    const [meta] = csf.objects({ stories: false });
    expect(meta.move(['parameters', 'code'], ['globals', 'code'])).toEqual({
      ok: true,
      changed: true,
    });
    expect(printCsf(csf).code).toBe(
      'export default {\n  globals: {\n    code: `line1\nline2`,\n  },\n};'
    );
    const [again] = parse(printCsf(csf).code).objects({ stories: false });
    expect(again.getValue(['globals', 'code'])).toBe('line1\nline2');
  });
});

describe('printMembers', () => {
  it('leaves the template literal of a function value alone', () => {
    expect(printMembers(['fn: () => {\n  return `a\nb`;\n}'])).toBe(
      '{\n  fn: () => {\n    return `a\nb`;\n  },\n}'
    );
  });
});

describe('generateMap', () => {
  const original = `const a = 1;\nconst b = 2;\nexport default { title: 'A' };\n`;
  // An earlier transform: drops the first line and maps the result back to `original`.
  const transform = (source: string) => {
    const edited = new MagicString(original).remove(0, original.indexOf('\n') + 1);
    return {
      code: edited.toString(),
      map: edited.generateMap({ hires: true, source, includeContent: true }),
    };
  };
  const editOf = (editor: SourceEditor) =>
    editor.edits.appendLeft(editor.code.indexOf('export'), 'const c = 3;\n');
  const entryOf = (map: object, code: string, token: string) => {
    const line = code.split('\n').findIndex((text) => text.includes(token));
    return new NodeSourceMap(map as ConstructorParameters<typeof NodeSourceMap>[0]).findEntry(
      line,
      code.split('\n')[line].indexOf(token)
    );
  };

  it('keeps the names of a two-source input map whose first source is unused', () => {
    const { code, map } = transform('real.ts');
    const unused = {
      ...map,
      sources: ['unused.ts', 'real.ts'],
      sourcesContent: [null, original],
      mappings: encode(
        decode(map.mappings).map((line) =>
          line.map(
            (segment) =>
              (segment.length > 1 ? [segment[0], 1, segment[2]!, segment[3]!] : segment) as never
          )
        )
      ),
    };
    const editor = new SourceEditor(code, 'out.ts');
    editOf(editor);
    const result = editor.generateMap({ inputSourceMap: unused });
    expect(result.sources).toEqual(['real.ts']);
    expect(result.sourcesContent).toEqual([original]);
    expect(entryOf(result, editor.toString(), 'title')).toMatchObject({
      originalSource: 'real.ts',
      originalLine: 2,
    });
  });

  it('keeps sourceRoot and the names relative to it', () => {
    const { code, map } = transform('Button.stories.tsx');
    const editor = new SourceEditor(code, 'out.ts');
    editOf(editor);
    const result = editor.generateMap({
      inputSourceMap: { ...map, sourceRoot: 'webpack:///src/' },
    });
    expect(result.sources).toEqual(['Button.stories.tsx']);
    expect(result.sourceRoot).toBe('webpack:///src/');
  });

  it('names the source as requested after a committed edit', () => {
    const editor = new SourceEditor(original, 'file.ts');
    editOf(editor);
    editor.commit();
    editor.edits.appendLeft(0, '// header\n');
    const result = editor.generateMap({ source: 'Custom.tsx' });
    expect(result.sources).toEqual(['Custom.tsx']);
    expect(entryOf(result, editor.toString(), 'title')).toMatchObject({
      originalSource: 'Custom.tsx',
      originalLine: 2,
    });
  });
});
