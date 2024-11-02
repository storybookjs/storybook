import { describe, expect, it, vi } from 'vitest';

import { isFunction, isObject } from '../type-guards';

describe('type-guards - isFunction', () => {
  it('should return true for regular functions', () => {
    function testFn() {}
    expect(isFunction(testFn)).toBe(true);
  });

  it('should return true for arrow functions', () => {
    const arrowFn = () => {};
    expect(isFunction(arrowFn)).toBe(true);
  });

  it('should return true for class methods', () => {
    class TestClass {
      method() {}
    }
    const instance = new TestClass();
    expect(isFunction(instance.method)).toBe(true);
  });

  it('should return true for built-in functions', () => {
    expect(isFunction(setTimeout)).toBe(true);
    expect(isFunction(console.log)).toBe(true);
  });

  it('should return false for non-function values', () => {
    expect(isFunction(null)).toBe(false);
    expect(isFunction(undefined)).toBe(false);
    expect(isFunction(42)).toBe(false);
    expect(isFunction('string')).toBe(false);
    expect(isFunction({})).toBe(false);
    expect(isFunction([])).toBe(false);
    expect(isFunction(true)).toBe(false);
  });
});

describe('type-guards - isObject()', () => {
  it('should return true for plain objects', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ a: 1 })).toBe(true);
  });

  it('should return true for class instances', () => {
    class TestClass {}
    const instance = new TestClass();
    expect(isObject(instance)).toBe(true);
  });

  it('should return false for null and undefined', () => {
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
  });

  it('should return false for arrays', () => {
    expect(isObject([])).toBe(false);
    expect(isObject([1, 2, 3])).toBe(false);
  });

  it('should return false for primitive values', () => {
    expect(isObject(42)).toBe(false);
    expect(isObject('string')).toBe(false);
    expect(isObject(true)).toBe(false);
    expect(isObject(Symbol('test'))).toBe(false);
  });

  it('should return true for complex objects', () => {
    const date = new Date();
    const map = new Map();
    const set = new Set();

    expect(isObject(date)).toBe(true);
    expect(isObject(map)).toBe(true);
    expect(isObject(set)).toBe(true);
  });
});
