import { describe, expect, it } from 'vitest';

import { formatInputValue } from './template-grammar.ts';

describe('formatInputValue', () => {
  it('renders primitives as their literal text and strings single-quoted', () => {
    expect(formatInputValue(7)).toBe('7');
    expect(formatInputValue(true)).toBe('true');
    expect(formatInputValue(null)).toBe('null');
    expect(formatInputValue(undefined)).toBe('undefined');
    expect(formatInputValue('Save')).toBe("'Save'");
  });

  it('renders objects and arrays with unquoted identifier keys and spaced separators', () => {
    expect(formatInputValue({ id: 7, tags: ['a', 'b'], nested: { deep: true } })).toBe(
      "{id: 7, tags: ['a', 'b'], nested: {deep: true}}"
    );
  });

  it('quotes a key that is not an identifier', () => {
    expect(formatInputValue({ 'data-id': 1 })).toBe("{'data-id': 1}");
  });

  it('keeps a comma inside a string value intact', () => {
    expect(formatInputValue({ hello: '1,2' })).toBe("{hello: '1,2'}");
  });

  it('preserves typographic quotes instead of collapsing them into escapes', () => {
    expect(formatInputValue({ text: 'it’s “great”' })).toBe("{text: 'it’s “great”'}");
  });

  it('escapes the quoting it introduces and entity-encodes the attribute delimiter', () => {
    expect(formatInputValue("it's")).toBe("'it\\'s'");
    expect(formatInputValue('say "hi"')).toBe("'say &quot;hi&quot;'");
    expect(formatInputValue({ path: 'a\\b' })).toBe("{path: 'a\\\\b'}");
    expect(formatInputValue('line\nbreak')).toBe("'line\\nbreak'");
  });

  it('caps a circular reference instead of recursing forever', () => {
    const value: Record<string, unknown> = { name: 'loop' };
    value.self = value;
    expect(formatInputValue(value)).toBe("{name: 'loop', self: '[Circular]'}");
  });
});
