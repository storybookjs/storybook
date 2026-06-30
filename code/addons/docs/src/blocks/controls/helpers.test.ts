import { describe, expect, it } from 'vitest';

import {
  getControlId,
  getControlSetterButtonId,
  isJsonSerializable,
  safeStringify,
} from './helpers';

describe('getControlId', () => {
  it.each([
    // caseName, input, expected
    ['lower case', 'some-id', 'control-some-id'],
    ['upper case', 'SOME-ID', 'control-SOME-ID'],
    ['all valid characters', 'some_weird-:custom.id', 'control-some_weird-:custom.id'],
  ])('%s', (name, input, expected) => {
    expect(getControlId(input)).toBe(expected);
  });

  it('includes storyId when provided', () => {
    expect(getControlId('some-id', 'story--name')).toBe('control-story--name-some-id');
  });

  it('includes controlsId when provided', () => {
    expect(getControlId('some-id', undefined, 'r1')).toBe('control-r1-some-id');
  });

  it('includes both controlsId and storyId when provided', () => {
    expect(getControlId('some-id', 'story--name', 'r1')).toBe('control-r1-story--name-some-id');
  });
});

describe('getControlSetterButtonId', () => {
  it.each([
    // caseName, input, expected
    ['lower case', 'some-id', 'set-some-id'],
    ['upper case', 'SOME-ID', 'set-SOME-ID'],
    ['all valid characters', 'some_weird-:custom.id', 'set-some_weird-:custom.id'],
  ])('%s', (name, input, expected) => {
    expect(getControlSetterButtonId(input)).toBe(expected);
  });

  it('includes storyId when provided', () => {
    expect(getControlSetterButtonId('some-id', 'story--name')).toBe('set-story--name-some-id');
  });

  it('includes controlsId when provided', () => {
    expect(getControlSetterButtonId('some-id', undefined, 'r1')).toBe('set-r1-some-id');
  });

  it('includes both controlsId and storyId when provided', () => {
    expect(getControlSetterButtonId('some-id', 'story--name', 'r1')).toBe(
      'set-r1-story--name-some-id'
    );
  });
});

describe('safeStringify', () => {
  it('matches JSON.stringify for plain serializable values', () => {
    const value = { a: 1, b: [2, 3], c: { d: 'e' } };
    expect(safeStringify(value, 2)).toBe(JSON.stringify(value, null, 2));
  });

  it('preserves shared (non-circular) references on the fast path', () => {
    const shared = { id: 1 };
    expect(safeStringify({ x: shared, y: shared })).toBe('{"x":{"id":1},"y":{"id":1}}');
  });

  it('does not throw on a circular structure (e.g. a Vue VNode: el -> __vnode -> el)', () => {
    const el: any = {};
    const vnode: any = { type: 'p', el };
    el.__vnode = vnode;

    expect(() => safeStringify(vnode, 2)).not.toThrow();
    const result = safeStringify(vnode, 2);
    expect(result).toContain('"type": "p"');
    expect(result).toContain('[Circular]');
  });

  it('does not throw on BigInt values', () => {
    expect(() => safeStringify({ big: 10n })).not.toThrow();
    expect(safeStringify({ big: 10n })).toBe('{"big":"10n"}');
  });
});

describe('isJsonSerializable', () => {
  it('returns true for plain JSON values', () => {
    expect(isJsonSerializable({ a: 1, b: [2, { c: 'd' }] })).toBe(true);
    expect(isJsonSerializable('string')).toBe(true);
    expect(isJsonSerializable(null)).toBe(true);
  });

  it('returns false for circular structures (e.g. a Vue VNode: el -> __vnode -> el)', () => {
    const el: any = {};
    const vnode: any = { type: 'p', el };
    el.__vnode = vnode;

    expect(isJsonSerializable(vnode)).toBe(false);
  });
});
