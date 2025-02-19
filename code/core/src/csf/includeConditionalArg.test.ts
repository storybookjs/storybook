import { describe, expect, it } from 'vitest';

import { includeConditionalArg, testValue } from './includeConditionalArg';
import type { Conditional } from './story';

describe('testValue', () => {
  describe('truthy', () => {
    it.each([
      ['implicit true', {}, true, true],
      ['implicit truthy', {}, 1, true],
      ['implicit falsey', {}, 0, false],
      ['truthy true', { truthy: true }, true, true],
      ['truthy truthy', { truthy: true }, 1, true],
      ['truthy falsey', { truthy: true }, 0, false],
      ['falsey true', { truthy: false }, true, false],
      ['falsey truthy', { truthy: false }, 1, false],
      ['falsey falsey', { truthy: false }, 0, true],
    ])('%s', (_name, cond, value, expected) => {
      expect(testValue(cond, value)).toBe(expected);
    });
  });

  describe('exists', () => {
    it.each([
      ['exist', { exists: true }, 1, true],
      ['exist false', { exists: true }, undefined, false],
      ['nexist', { exists: false }, undefined, true],
      ['nexist false', { exists: false }, 1, false],
    ])('%s', (_name, cond, value, expected) => {
      expect(testValue(cond, value)).toBe(expected);
    });
  });
  describe('eq', () => {
    it.each([
      ['true', { eq: 1 }, 1, true],
      ['false', { eq: 1 }, 2, false],
      ['undefined', { eq: undefined }, undefined, false],
      ['undefined false', { eq: 1 }, undefined, false],
      ['object true', { eq: { x: 1 } }, { x: 1 }, true],
      ['object false', { eq: { x: 1 } }, { x: 2 }, false],
    ])('%s', (_name, cond, value, expected) => {
      expect(testValue(cond, value)).toBe(expected);
    });
  });
  describe('neq', () => {
    it.each([
      ['true', { neq: 1 }, 2, true],
      ['false', { neq: 1 }, 1, false],
      ['undefined true', { neq: 1 }, undefined, true],
      ['undefined false', { neq: undefined }, undefined, false],
      ['object true', { neq: { x: 1 } }, { x: 2 }, true],
      ['object false', { neq: { x: 1 } }, { x: 1 }, false],
    ])('%s', (_name, cond, value, expected) => {
      expect(testValue(cond, value)).toBe(expected);
    });
  });
});

describe('includeConditionalArg', () => {
  describe('errors', () => {
    it('should throw if neither arg nor global is specified', () => {
      expect(() =>
        includeConditionalArg({ if: {} as Conditional }, {}, {})
      ).toThrowErrorMatchingInlineSnapshot(`[Error: Invalid conditional value {}]`);
    });
    it('should throw if arg and global are both specified', () => {
      expect(() =>
        includeConditionalArg({ if: { arg: 'a', global: 'b' } }, {}, {})
      ).toThrowErrorMatchingInlineSnapshot(
        `[Error: Invalid conditional value {"arg":"a","global":"b"}]`
      );
    });
    it('should throw if multiple exists / eq / neq are specified', () => {
      expect(() =>
        includeConditionalArg({ if: { arg: 'a', exists: true, eq: 1 } }, {}, {})
      ).toThrowErrorMatchingInlineSnapshot(
        `[Error: Invalid conditional test {"exists":true,"eq":1}]`
      );

      expect(() =>
        includeConditionalArg({ if: { arg: 'a', exists: false, neq: 0 } }, {}, {})
      ).toThrowErrorMatchingInlineSnapshot(
        `[Error: Invalid conditional test {"exists":false,"neq":0}]`
      );

      expect(() =>
        includeConditionalArg({ if: { arg: 'a', eq: 1, neq: 0 } }, {}, {})
      ).toThrowErrorMatchingInlineSnapshot(`[Error: Invalid conditional test {"eq":1,"neq":0}]`);
    });
  });

  describe('args', () => {
    describe('implicit', () => {
      it.each([
        ['implicit true', { if: { arg: 'a' } }, { a: 1 }, {}, true],
        ['truthy true', { if: { arg: 'a', truthy: true } }, { a: 0 }, {}, false],
        ['truthy false', { if: { arg: 'a', truthy: false } }, {}, {}, true],
      ])('%s', (_name, argType, args, globals, expected) => {
        expect(includeConditionalArg(argType, args, globals)).toBe(expected);
      });
    });
    describe('exists', () => {
      it.each([
        ['exist', { if: { arg: 'a', exists: true } }, { a: 1 }, {}, true],
        ['exist false', { if: { arg: 'a', exists: true } }, {}, {}, false],
      ])('%s', (_name, argType, args, globals, expected) => {
        expect(includeConditionalArg(argType, args, globals)).toBe(expected);
      });
    });
    describe('eq', () => {
      it.each([
        ['scalar true', { if: { arg: 'a', eq: 1 } }, { a: 1 }, {}, true],
        ['scalar false', { if: { arg: 'a', eq: 1 } }, { a: 2 }, { a: 1 }, false],
      ])('%s', (_name, argType, args, globals, expected) => {
        expect(includeConditionalArg(argType, args, globals)).toBe(expected);
      });
    });
    describe('neq', () => {
      it.each([
        ['scalar true', { if: { arg: 'a', neq: 1 } }, { a: 2 }, {}, true],
        ['scalar false', { if: { arg: 'a', neq: 1 } }, { a: 1 }, { a: 2 }, false],
      ])('%s', (_name, argType, args, globals, expected) => {
        expect(includeConditionalArg(argType, args, globals)).toBe(expected);
      });
    });
  });
  describe('globals', () => {
    describe('truthy', () => {
      it.each([
        ['implicit true', { if: { global: 'a' } }, {}, { a: 1 }, true],
        ['implicit undefined', { if: { global: 'a' } }, {}, {}, false],
        ['truthy true', { if: { global: 'a', truthy: true } }, {}, { a: 0 }, false],
        ['truthy false', { if: { global: 'a', truthy: false } }, {}, { a: 0 }, true],
      ])('%s', (_name, argType, args, globals, expected) => {
        expect(includeConditionalArg(argType, args, globals)).toBe(expected);
      });
    });
    describe('exists', () => {
      it.each([
        ['implicit exist true', { if: { global: 'a', exists: true } }, {}, { a: 1 }, true],
        ['implicit exist false', { if: { global: 'a', exists: true } }, { a: 1 }, {}, false],
      ])('%s', (_name, argType, args, globals, expected) => {
        expect(includeConditionalArg(argType, args, globals)).toBe(expected);
      });
    });
    describe('eq', () => {
      it.each([
        ['scalar true', { if: { global: 'a', eq: 1 } }, {}, { a: 1 }, true],
        ['scalar false', { if: { global: 'a', eq: 1 } }, { a: 2 }, { a: 2 }, false],
      ])('%s', (_name, argType, args, globals, expected) => {
        expect(includeConditionalArg(argType, args, globals)).toBe(expected);
      });
    });
    describe('neq', () => {
      it.each([
        ['scalar true', { if: { global: 'a', neq: 1 } }, {}, { a: 2 }, true],
        ['scalar false', { if: { global: 'a', neq: 1 } }, { a: 2 }, { a: 1 }, false],
      ])('%s', (_name, argType, args, globals, expected) => {
        expect(includeConditionalArg(argType, args, globals)).toBe(expected);
      });
    });
  });
});
