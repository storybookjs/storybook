import { describe, expect, it } from 'vitest';

import { parser, types as t } from 'storybook/internal/babel';

import {
  findIndirectProperty,
  getStaticProperties,
  getStaticPropertyName,
} from './config-object.ts';

const parseObject = (source: string) => {
  const expression = parser.parseExpression(source, { plugins: ['typescript'] });
  if (!t.isObjectExpression(expression)) {
    throw new Error(`expected an object expression, got ${expression.type}`);
  }
  return expression;
};

const firstMember = (source: string) => parseObject(source).properties[0];

describe('getStaticPropertyName', () => {
  it.each([
    ['identifier key', `{ storySort: 1 }`, 'storySort'],
    ['string literal key', `{ 'storySort': 1 }`, 'storySort'],
    ['shorthand', `{ storySort }`, 'storySort'],
    ['object method', `{ storySort(a, b) { return 0 } }`, 'storySort'],
    ['getter', `{ get storySort() { return 0 } }`, 'storySort'],
    ['reserved word key', `{ default: 1 }`, 'default'],
    ['key needing quotes', `{ 'story-sort': 1 }`, 'story-sort'],
  ])('reads a %s', (_name, source, expected) => {
    expect(getStaticPropertyName(firstMember(source))).toBe(expected);
  });

  it.each([
    ['spread element', `{ ...rest }`],
    ['computed identifier key', `{ [key]: 1 }`],
    ['computed string literal key', `{ ['storySort']: 1 }`],
    ['computed template key', `{ [\`storySort\`]: 1 }`],
    ['computed method key', `{ [key]() { return 0 } }`],
    ['numeric key', `{ 0: 1 }`],
    ['bigint key', `{ 0n: 1 }`],
  ])('returns undefined for a %s', (_name, source) => {
    expect(getStaticPropertyName(firstMember(source))).toBeUndefined();
  });

  it('does not confuse a computed key with the identifier it references', () => {
    expect(getStaticPropertyName(firstMember(`{ [storySort]: 1 }`))).toBeUndefined();
  });
});

describe('findIndirectProperty', () => {
  it('returns undefined when every key is statically readable', () => {
    expect(
      findIndirectProperty(parseObject(`{ a: 1, 'b': 2, c() {}, get d() { return 3 } }`))
    ).toBeUndefined();
  });

  it.each([
    ['spread', `{ a: 1, ...rest }`],
    ['computed key', `{ a: 1, [key]: 2 }`],
    ['computed string literal key', `{ a: 1, ['b']: 2 }`],
    ['numeric key', `{ a: 1, 0: 2 }`],
  ])('returns the offending member for a %s', (_name, source) => {
    const object = parseObject(source);
    expect(findIndirectProperty(object)).toBe(object.properties[1]);
  });

  it('returns the first offender so callers report the earliest source location', () => {
    const object = parseObject(`{ a: 1, [key]: 2, ...rest }`);
    expect(findIndirectProperty(object)).toBe(object.properties[1]);
  });

  it('returns undefined for an empty object', () => {
    expect(findIndirectProperty(parseObject(`{}`))).toBeUndefined();
  });
});

describe('getStaticProperties', () => {
  it('returns every member whose static key matches', () => {
    const object = parseObject(`{ a: 1, b: 2, a: 3 }`);
    expect(getStaticProperties(object, 'a')).toEqual([object.properties[0], object.properties[2]]);
  });

  it('matches identifier and string literal spellings of the same key', () => {
    expect(getStaticProperties(parseObject(`{ a: 1, 'a': 2 }`), 'a')).toHaveLength(2);
  });

  it('does not match a computed key that spells the name', () => {
    expect(getStaticProperties(parseObject(`{ ['a']: 1 }`), 'a')).toHaveLength(0);
  });

  it('does not match a spread that might contribute the name', () => {
    expect(getStaticProperties(parseObject(`{ ...rest }`), 'a')).toHaveLength(0);
  });

  it('returns an empty array when the key is absent', () => {
    expect(getStaticProperties(parseObject(`{ b: 1 }`), 'a')).toEqual([]);
  });
});
