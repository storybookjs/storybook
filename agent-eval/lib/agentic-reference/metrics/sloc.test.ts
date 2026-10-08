import { describe, expect, it } from 'vitest';

import { countSloc, hasParseErrors, stripToSloc } from './sloc.ts';

describe('hasParseErrors', () => {
  it('reports no errors for valid code', () => {
    expect(hasParseErrors('a.ts', 'function a(){ return 1 }')).toBe(false);
  });

  it('reports errors for broken code the parser silently recovers from', () => {
    // TypeScript recovers this into a malformed declaration rather than
    // throwing, so "the walker found no functions" would not have caught it.
    expect(hasParseErrors('a.ts', 'function ( { { {')).toBe(true);
    expect(hasParseErrors('a.ts', 'const = = =')).toBe(true);
  });

  it('accepts a generic arrow in .ts, which TSX mode would reject', () => {
    expect(hasParseErrors('a.ts', 'const f = <T,>(x: T) => x')).toBe(false);
  });

  it('accepts JSX in .tsx', () => {
    expect(hasParseErrors('a.tsx', 'const C = () => <div>hi</div>')).toBe(false);
  });
});

describe('stripToSloc', () => {
  it('keeps plain code untouched', () => {
    expect(stripToSloc('const a = 1\nconst b = 2\n', 'a.ts')).toBe('const a = 1\nconst b = 2');
  });

  it('drops blank and whitespace-only lines', () => {
    expect(stripToSloc('const a = 1\n\n   \nconst b = 2\n', 'a.ts')).toBe(
      'const a = 1\nconst b = 2'
    );
  });

  it('drops whole-line comments', () => {
    expect(stripToSloc('// leading\nconst a = 1\n', 'a.ts')).toBe('const a = 1');
  });

  it('keeps code that has a trailing comment', () => {
    expect(stripToSloc('const a = 1 // why\n', 'a.ts')).toBe('const a = 1');
  });

  it('drops multi-line block comments entirely', () => {
    const source = '/**\n * docs\n * more docs\n */\nconst a = 1\n';
    expect(stripToSloc(source, 'a.ts')).toBe('const a = 1');
  });

  it('does not mistake // inside a string for a comment', () => {
    const source = "const url = 'https://example.com'\n";
    expect(stripToSloc(source, 'a.ts')).toBe(source.trimEnd());
  });

  it('does not mistake // inside a regex literal for a comment', () => {
    const source = 'const re = /https:\\/\\//\nconst a = 1\n';
    expect(countSloc(source, 'a.ts')).toBe(2);
  });

  it('does not mistake // inside a template literal for a comment', () => {
    const source = 'const t = `see //here`\nconst a = 1\n';
    expect(countSloc(source, 'a.ts')).toBe(2);
  });

  it('handles JSX and its comment syntax', () => {
    const source = 'const a = <div>\n  {/* a jsx comment */}\n  <span>hi</span>\n</div>\n';
    // The braces survive as code; only the comment text is removed.
    expect(countSloc(source, 'a.tsx')).toBe(4);
  });

  it('parses generic arrow functions in .ts as generics, not JSX', () => {
    const source = 'const identity = <T,>(value: T): T => value\n';
    expect(countSloc(source, 'a.ts')).toBe(1);
  });

  it('strips block comments from CSS', () => {
    const source = '.a {\n  /* a note */\n  color: red;\n}\n';
    expect(countSloc(source, 'a.css')).toBe(3);
  });

  it('returns the source unchanged for unknown extensions', () => {
    expect(stripToSloc('# a heading\n', 'README.md')).toBe('# a heading');
  });

  it('falls back to the raw text when a file cannot be parsed', () => {
    // Deliberately broken input must not throw; it is still diffable text.
    expect(() => stripToSloc('const = = =\n', 'a.ts')).not.toThrow();
  });
});

describe('countSloc', () => {
  it('counts remaining lines', () => {
    expect(countSloc('// c\n\nconst a = 1\nconst b = 2\n', 'a.ts')).toBe(2);
  });

  it('counts an empty file as zero', () => {
    expect(countSloc('', 'a.ts')).toBe(0);
    expect(countSloc('\n\n\n', 'a.ts')).toBe(0);
  });
});
