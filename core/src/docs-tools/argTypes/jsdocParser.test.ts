import { describe, expect, it } from 'vitest';

import { parseJsDoc } from './jsdocParser';

describe('parseJsDoc', () => {
  it('should set includesJsDoc to false when the value is null', () => {
    const { includesJsDoc, description, extractedTags } = parseJsDoc(null, {});

    expect(includesJsDoc).toBeFalsy();
    expect(description).toBeUndefined();
    expect(extractedTags).toBeUndefined();
  });

  it('should set includesJsDoc to false when the value dont contains JSDoc', () => {
    const { includesJsDoc, description, extractedTags } = parseJsDoc('Hey!');

    expect(includesJsDoc).toBeFalsy();
    expect(description).toBeUndefined();
    expect(extractedTags).toBeUndefined();
  });

  it('should set includesJsDoc to true when the value contains JSDoc', () => {
    const { includesJsDoc } = parseJsDoc('Hey!\n@version 1.2');

    expect(includesJsDoc).toBeTruthy();
  });

  it('should remove all JSDoc tags from the description', () => {
    const { description } = parseJsDoc('Hey!\n@version 1.2\n@deprecated');

    expect(description).toBe('Hey!');
  });

  describe('@ignore', () => {
    it('should set ignore to true when @ignore is present', () => {
      const { ignore, description, extractedTags } = parseJsDoc('Hey!\n@ignore');

      expect(ignore).toBeTruthy();
      expect(description).toBeUndefined();
      expect(extractedTags).toBeUndefined();
    });

    it('should set ignore to false when @ignore is not present', () => {
      const { ignore } = parseJsDoc('Hey!\n@version 1.2');

      expect(ignore).toBeFalsy();
    });
  });

  describe('@param', () => {
    it('should ignore invalid @param tags', () => {
      const { extractedTags } = parseJsDoc('@param');

      expect(extractedTags?.params).toBeNull();
    });

    it('should return a @param with a name', () => {
      const { extractedTags } = parseJsDoc('@param event');

      expect(extractedTags?.params).not.toBeNull();
      expect(extractedTags?.params?.[0].name).toBe('event');
      expect(extractedTags?.params?.[0].type).toBeNull();
      expect(extractedTags?.params?.[0].description).toBeNull();
    });

    it('should return a @param with a name and a type', () => {
      const { extractedTags } = parseJsDoc('@param {SyntheticEvent} event');

      expect(extractedTags?.params).not.toBeNull();
      expect(extractedTags?.params?.[0].name).toBe('event');
      expect(extractedTags?.params?.[0].type).not.toBeNull();
      expect(extractedTags?.params?.[0].type.value).toBe('SyntheticEvent');
      expect(extractedTags?.params?.[0].description).toBeNull();
    });

    it('should return a @param with a name, a type and a description', () => {
      const { extractedTags } = parseJsDoc('@param {SyntheticEvent} event - React event');

      expect(extractedTags?.params).not.toBeNull();
      expect(extractedTags?.params?.[0].name).toBe('event');
      expect(extractedTags?.params?.[0].type).not.toBeNull();
      expect(extractedTags?.params?.[0].type.value).toBe('SyntheticEvent');
      expect(extractedTags?.params?.[0].description).toBe('React event');
    });

    it('should support multiple @param tags', () => {
      const { extractedTags } = parseJsDoc(
        '@param {SyntheticEvent} event1 - React event\n@param {SyntheticEvent} event2 - React event\n@param {SyntheticEvent} event3 - React event'
      );

      ['event1', 'event2', 'event3'].forEach((x, i) => {
        expect(extractedTags?.params?.[i].name).toBe(x);
        expect(extractedTags?.params?.[i].type).not.toBeNull();
        expect(extractedTags?.params?.[i].type.value).toBe('SyntheticEvent');
        expect(extractedTags?.params?.[i].description).toBe('React event');
      });
    });

    it('should not return extra @param', () => {
      const { extractedTags } = parseJsDoc('@param event');

      expect(Object.keys(extractedTags?.params ?? []).length).toBe(1);
    });

    it('should support multiline description when there is a @param', () => {
      const { description, extractedTags } = parseJsDoc(
        'This is a\nmultiline description\n@param event'
      );

      expect(description).toBe('This is a\nmultiline description');
      expect(extractedTags?.params).not.toBeNull();
      expect(extractedTags?.params?.[0].name).toBe('event');
    });

    it('should support multiline @param description', () => {
      const { extractedTags } = parseJsDoc(
        '@param event - This is a\nmultiline description\n@param anotherEvent'
      );

      expect(extractedTags?.params).not.toBeNull();
      expect(extractedTags?.params?.[0].name).toBe('event');
      expect(extractedTags?.params?.[0].description).toBe('This is a\nmultiline description');
      expect(extractedTags?.params?.[1].name).toBe('anotherEvent');
    });

    ['@arg', '@argument'].forEach((x) => {
      it(`should support ${x} alias`, () => {
        const { extractedTags } = parseJsDoc(`${x} {SyntheticEvent} event - React event`);

        expect(extractedTags?.params).not.toBeNull();
        expect(extractedTags?.params?.[0].name).toBe('event');
        expect(extractedTags?.params?.[0].type).not.toBeNull();
        expect(extractedTags?.params?.[0].type.value).toBe('SyntheticEvent');
        expect(extractedTags?.params?.[0].description).toBe('React event');
      });
    });

    describe('getTypeName', () => {
      it('should support record type with a single field', () => {
        const { extractedTags } = parseJsDoc('@param {{a: number}} event');

        expect(extractedTags?.params?.[0].getTypeName()).toBe('({a: number})');
      });

      it('should support record type with multiple fields', () => {
        const { extractedTags } = parseJsDoc('@param {{a: number, b: string}} event');

        expect(extractedTags?.params?.[0].getTypeName()).toBe('({a: number, b: string})');
      });

      it('should support record type with a field having only a name', () => {
        const { extractedTags } = parseJsDoc('@param {{a}} event');

        expect(extractedTags?.params?.[0].getTypeName()).toBe('({a})');
      });

      it('should support union type', () => {
        const { extractedTags } = parseJsDoc('@param {(number|boolean)} event');

        expect(extractedTags?.params?.[0].getTypeName()).toBe('(number|boolean)');
      });

      it('should support array type', () => {
        const { extractedTags } = parseJsDoc('@param {number[]} event');

        expect(extractedTags?.params?.[0].getTypeName()).toBe('number[]');
      });

      it('should support untyped array type', () => {
        const { extractedTags } = parseJsDoc('@param {[]} event');

        expect(extractedTags?.params?.[0].getTypeName()).toBe('[]');
      });

      it('should support nullable type', () => {
        const { extractedTags } = parseJsDoc('@param {?number} event');

        expect(extractedTags?.params?.[0].getTypeName()).toBe('number');
      });

      it('should support non nullable type', () => {
        const { extractedTags } = parseJsDoc('@param {!number} event');

        expect(extractedTags?.params?.[0].getTypeName()).toBe('number');
      });

      it('should support optional param with []', () => {
        const { extractedTags } = parseJsDoc('@param {number} [event]');

        expect(extractedTags?.params?.[0].getTypeName()).toBe('number');
      });

      it('should support optional param with =', () => {
        const { extractedTags } = parseJsDoc('@param {number=} event');

        expect(extractedTags?.params?.[0].getTypeName()).toBe('number');
      });

      it('should support any type', () => {
        const { extractedTags } = parseJsDoc('@param {*} event');

        expect(extractedTags?.params?.[0].getTypeName()).toBe('any');
      });
    });

    describe('getPrettyName', () => {
      it('should return @param name', () => {
        const { extractedTags } = parseJsDoc('@param {SyntheticEvent} event - React event');

        expect(extractedTags?.params?.[0].getPrettyName()).toBe('event');
      });

      it('should fix missing space between the @param name and the description separator', () => {
        const { extractedTags } = parseJsDoc('@param {SyntheticEvent} event- React event');

        expect(extractedTags?.params?.[0].getPrettyName()).toBe('event');
      });

      it('should fix @param name ending with . followed by a @returns tag', () => {
        const { extractedTags } = parseJsDoc('@param {SyntheticEvent} event.\n');

        expect(extractedTags?.params?.[0].getPrettyName()).toBe('event');
      });
    });
  });

  describe('@deprecated', () => {
    it('should ignore invalid @deprecated', () => {
      const { extractedTags } = parseJsDoc('@deprecated');

      expect(extractedTags?.returns).toBeNull();
    });

    it('should return a @deprecated with a name', () => {
      const { extractedTags } = parseJsDoc('@deprecated string');

      expect(extractedTags?.deprecated).not.toBeNull();
      expect(extractedTags?.deprecated).not.toBeNull();
      expect(extractedTags?.deprecated).toBe('string');
    });
  });

  describe('@returns', () => {
    it('should ignore invalid @returns', () => {
      const { extractedTags } = parseJsDoc('@returns');

      expect(extractedTags?.returns).toBeNull();
    });

    it('should return a @returns with a type', () => {
      const { extractedTags } = parseJsDoc('@returns {string}');

      expect(extractedTags?.returns).not.toBeNull();
      expect(extractedTags?.returns?.type).not.toBeNull();
      expect(extractedTags?.returns?.type.value).toBe('string');
    });

    it('should return a @returns with a type and a description', () => {
      const { extractedTags } = parseJsDoc('@returns {string} - A bar description');

      expect(extractedTags?.returns).not.toBeNull();
      expect(extractedTags?.returns?.type).not.toBeNull();
      expect(extractedTags?.returns?.type.value).toBe('string');
      expect(extractedTags?.returns?.description).toBe('A bar description');
    });

    it('should support multiline @returns description', () => {
      const { extractedTags } = parseJsDoc(
        '@returns {string} - This is\na multiline\ndescription\n'
      );

      expect(extractedTags?.returns).not.toBeNull();
      expect(extractedTags?.returns?.type).not.toBeNull();
      expect(extractedTags?.returns?.type.value).toBe('string');
      expect(extractedTags?.returns?.description).toBe('This is\na multiline\ndescription');
    });

    it('should only consider the last @returns tag when there is multiple', () => {
      const { extractedTags } = parseJsDoc('@returns {string}\n@returns {number}');

      expect(extractedTags?.returns).not.toBeNull();
      expect(extractedTags?.returns?.type).not.toBeNull();
      expect(extractedTags?.returns?.type.value).toBe('number');
    });

    describe('getTypeName', () => {
      it('should support named type', () => {
        const { extractedTags } = parseJsDoc('@returns {string}');

        expect(extractedTags?.returns?.getTypeName()).toBe('string');
      });

      it('should support record type with a single field', () => {
        const { extractedTags } = parseJsDoc('@returns {{a: number}}');

        expect(extractedTags?.returns?.getTypeName()).toBe('({a: number})');
      });

      it('should support record type with multiple fields', () => {
        const { extractedTags } = parseJsDoc('@returns {{a: number, b: string}}');

        expect(extractedTags?.returns?.getTypeName()).toBe('({a: number, b: string})');
      });

      it('should support record type with a field having only a name', () => {
        const { extractedTags } = parseJsDoc('@returns {{a}}');

        expect(extractedTags?.returns?.getTypeName()).toBe('({a})');
      });

      it('should support array type', () => {
        const { extractedTags } = parseJsDoc('@returns {integer[]}');

        expect(extractedTags?.returns?.getTypeName()).toBe('integer[]');
      });

      it('should support untyped array type', () => {
        const { extractedTags } = parseJsDoc('@returns {[]}');

        expect(extractedTags?.returns?.getTypeName()).toBe('[]');
      });

      it('should support union type', () => {
        const { extractedTags } = parseJsDoc('@returns {(number|boolean)}');

        expect(extractedTags?.returns?.getTypeName()).toBe('(number|boolean)');
      });

      it('should support any type', () => {
        const { extractedTags } = parseJsDoc('@returns {*}');

        expect(extractedTags?.returns?.getTypeName()).toBe('any');
      });

      it('should support void', () => {
        const { extractedTags } = parseJsDoc('@returns {void}');

        expect(extractedTags?.returns?.getTypeName()).toBe('void');
      });
    });
  });

  it('should ignore unsupported JSDoc tags', () => {
    const { extractedTags } = parseJsDoc('Hey!\n@param event', { tags: [] });

    expect(extractedTags?.params).toBeNull();
  });

  it('should remove extra newline characters between tags', () => {
    const { extractedTags } = parseJsDoc(
      'Hey!\n@param {SyntheticEvent} event - Original event.\n     \n     \n     \n@returns {string}'
    );

    expect(extractedTags?.params).not.toBeNull();
    expect(Object.keys(extractedTags?.params ?? []).length).toBe(1);
    expect(extractedTags?.params?.[0].name).toBe('event');
    expect(extractedTags?.params?.[0].type.value).toBe('SyntheticEvent');
    expect(extractedTags?.params?.[0].description).toBe('Original event.');
    expect(extractedTags?.returns).not.toBeNull();
    expect(extractedTags?.returns?.type.value).toBe('string');
  });
});
