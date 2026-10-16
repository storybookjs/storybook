import { describe, expect, it } from 'vitest';

import { babelParseFile } from '../CsfFile.ts';
import { resolveArgValue } from './resolve-arg-value.ts';
import {
  type ReferenceContext,
  resolveArgsRecord,
  resolveBindingMembers,
  sourceOf,
} from './resolve-members.ts';

const contextOf = (code: string, filePath = 'entry.ts'): ReferenceContext => ({
  program: babelParseFile({ code, filename: filePath }).path,
  filePath,
});

const valueOf = (code: string, expression: string) => {
  const ctx = contextOf(`${code}\nexport const Story = { args: { v: ${expression} } };`);
  const record = resolveArgsRecord(resolveBindingMembers(ctx, 'Story')?.properties.args, ctx);
  const resolved = resolveArgValue(record.properties.v, ctx);
  return {
    node: sourceOf(resolved.node),
    imports: resolved.imports.map((ref) => `${ref.localImportName}:${ref.importId}`),
    unresolved: resolved.unresolved,
  };
};

describe('resolveArgValue', () => {
  it('reads a local const through to the value it was declared with', () => {
    expect(valueOf(`const LOCAL_LABEL = 'local';`, 'LOCAL_LABEL')).toEqual({
      node: "'local'",
      imports: [],
      unresolved: [],
    });
  });

  it('follows a chain of local consts', () => {
    expect(valueOf(`const A = B; const B = 42;`, 'A')).toEqual({
      node: '42',
      imports: [],
      unresolved: [],
    });
  });

  it('keeps an imported name and reports the import it needs', () => {
    expect(valueOf(`import { IMPORTED_LABEL } from './constants';`, 'IMPORTED_LABEL')).toEqual({
      node: 'IMPORTED_LABEL',
      imports: ['IMPORTED_LABEL:./constants'],
      unresolved: [],
    });
  });

  it('reports the import a call expression reaches for', () => {
    expect(valueOf(`import { computeCount } from './helpers';`, 'computeCount(2)')).toEqual({
      node: 'computeCount(2)',
      imports: ['computeCount:./helpers'],
      unresolved: [],
    });
  });

  it('reports a local name a larger expression reaches for, which it cannot substitute', () => {
    expect(valueOf(`const factor = 2;`, 'factor * 3')).toEqual({
      node: 'factor * 3',
      imports: [],
      unresolved: ['factor'],
    });
  });

  it('reports the import a nested parameter of the same name does not hide', () => {
    expect(valueOf(`import { dep } from './helpers';`, '[dep => dep, dep]')).toEqual({
      node: '[dep => dep, dep]',
      imports: ['dep:./helpers'],
      unresolved: [],
    });
  });

  it('reads the name a shorthand property reaches for', () => {
    expect(valueOf(`import { dep } from './helpers';`, '{ dep }')).toEqual({
      node: '{ dep }',
      imports: ['dep:./helpers'],
      unresolved: [],
    });
  });

  it('writes out a spread inside an object the arg holds', () => {
    expect(valueOf(`const base = { size: 'md' };`, `{ ...base, tone: 'neutral' }`)).toEqual({
      node: "{ size: 'md', tone: 'neutral' }",
      imports: [],
      unresolved: [],
    });
  });

  it('leaves an object holding a spread it cannot read exactly as written', () => {
    expect(valueOf('', `{ ...buildBase(), tone: 'neutral' }`)).toEqual({
      node: "{ ...buildBase(), tone: 'neutral' }",
      imports: [],
      unresolved: ['...buildBase()'],
    });
  });

  it('keeps a shorthand property shorthand while writing out a sibling spread', () => {
    expect(
      valueOf(
        `import { dep } from './helpers'; const base = { size: 'md' };`,
        `{ dep, nested: { ...base } }`
      )
    ).toEqual({
      node: "{ dep, nested: { size: 'md' } }",
      imports: ['dep:./helpers'],
      unresolved: [],
    });
  });

  it('leaves a literal alone', () => {
    expect(valueOf('', `{ a: 1, b: [2, 3] }`)).toEqual({
      node: '{ a: 1, b: [2, 3] }',
      imports: [],
      unresolved: [],
    });
  });

  it('names nothing for a global or a parameter the expression declares itself', () => {
    expect(valueOf('', '(event) => Math.max(event.x, 0)')).toEqual({
      node: 'event => Math.max(event.x, 0)',
      imports: [],
      unresolved: [],
    });
  });
});
