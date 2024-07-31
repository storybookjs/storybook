import { describe, it, expect, vi } from 'vitest';
import { once } from '@storybook/core/client-logger';
import type { SBType } from '@storybook/core/types';

import {
  combineArgs,
  groupArgsByTarget,
  mapArgsToTypes,
  UNTARGETED,
  validateOptions,
} from './args';

const stringType: SBType = { name: 'string' };
const numberType: SBType = { name: 'number' };
const booleanType: SBType = { name: 'boolean' };
const enumType: SBType = { name: 'enum', value: [1, 2, 3] };
const functionType: SBType = { name: 'function' };
const numArrayType: SBType = { name: 'array', value: numberType };
const boolObjectType: SBType = { name: 'object', value: { bool: booleanType } };

vi.mock('@storybook/core/client-logger');

enum ArgsMapTestEnumWithoutInitializer {
  EnumValue,
  EnumValue2,
}

enum ArgsMapTestEnumWithStringInitializer {
  EnumValue = 'EnumValue',
}

enum ArgsMapTestEnumWithNumericInitializer {
  EnumValue = 4,
}

describe('mapArgsToTypes', () => {
  it('maps strings', () => {
    expect(mapArgsToTypes({ a: 'str' }, { a: { type: stringType } })).toStrictEqual({ a: 'str' });
    expect(mapArgsToTypes({ a: 42 }, { a: { type: stringType } })).toStrictEqual({ a: '42' });
  });

  it('maps enums', () => {
    expect(
      mapArgsToTypes({ a: ArgsMapTestEnumWithoutInitializer.EnumValue }, { a: { type: enumType } })
    ).toEqual({ a: 0 });
    expect(
      mapArgsToTypes({ a: ArgsMapTestEnumWithoutInitializer.EnumValue2 }, { a: { type: enumType } })
    ).toEqual({ a: 1 });
    expect(
      mapArgsToTypes(
        { a: ArgsMapTestEnumWithStringInitializer.EnumValue },
        { a: { type: enumType } }
      )
    ).toEqual({ a: 'EnumValue' });
    expect(
      mapArgsToTypes(
        { a: ArgsMapTestEnumWithNumericInitializer.EnumValue },
        { a: { type: enumType } }
      )
    ).toEqual({ a: 4 });
  });

  it('maps numbers', () => {
    expect(mapArgsToTypes({ a: '42' }, { a: { type: numberType } })).toStrictEqual({ a: 42 });
    expect(mapArgsToTypes({ a: '4.2' }, { a: { type: numberType } })).toStrictEqual({ a: 4.2 });
    expect(mapArgsToTypes({ a: 'a' }, { a: { type: numberType } })).toStrictEqual({ a: NaN });
  });

  it('maps booleans', () => {
    expect(mapArgsToTypes({ a: true }, { a: { type: booleanType } })).toStrictEqual({ a: true });
    expect(mapArgsToTypes({ a: 'true' }, { a: { type: booleanType } })).toStrictEqual({ a: true });
    expect(mapArgsToTypes({ a: false }, { a: { type: booleanType } })).toStrictEqual({
      a: false,
    });
    expect(mapArgsToTypes({ a: 'yes' }, { a: { type: booleanType } })).toStrictEqual({ a: false });
  });

  it('maps sparse arrays', () => {
    expect(mapArgsToTypes({ a: [, '2', undefined] }, { a: { type: numArrayType } })).toStrictEqual({
      a: [, 2, undefined],
    });
  });

  it('omits functions', () => {
    expect(mapArgsToTypes({ a: 'something' }, { a: { type: functionType } })).toStrictEqual({});
  });

  it('includes functions if there is a mapping', () => {
    expect(
      mapArgsToTypes(
        { a: 'something' },
        { a: { type: functionType, mapping: { something: () => 'foo' } } }
      )
    ).toStrictEqual({
      a: 'something',
    });
  });

  it('skips default mapping if there is a user-specified mapping', () => {
    expect(
      mapArgsToTypes({ a: 'something' }, { a: { type: numberType, mapping: { something: 10 } } })
    ).toStrictEqual({
      a: 'something',
    });
  });

  it('omits unknown keys', () => {
    expect(mapArgsToTypes({ a: 'string' }, { b: { type: stringType } })).toStrictEqual({});
  });

  it('passes through unmodified if no type is specified', () => {
    expect(mapArgsToTypes({ a: { b: 1 } }, { a: { type: undefined } })).toStrictEqual({
      a: { b: 1 },
    });
  });

  it('passes string for object type', () => {
    expect(mapArgsToTypes({ a: 'A' }, { a: { type: boolObjectType } })).toStrictEqual({ a: 'A' });
  });

  it('passes number for object type', () => {
    expect(mapArgsToTypes({ a: 1.2 }, { a: { type: boolObjectType } })).toStrictEqual({ a: 1.2 });
  });

  it('deeply maps objects', () => {
    expect(
      mapArgsToTypes(
        {
          key: {
            arr: ['1', '2'],
            obj: { bool: true },
          },
        },
        {
          key: {
            type: {
              name: 'object',
              value: {
                arr: numArrayType,
                obj: boolObjectType,
              },
            },
          },
        }
      )
    ).toStrictEqual({
      key: {
        arr: [1, 2],
        obj: { bool: true },
      },
    });
  });

  it('deeply maps arrays', () => {
    expect(
      mapArgsToTypes(
        {
          key: [
            {
              arr: ['1', '2'],
              obj: { bool: true },
            },
          ],
        },
        {
          key: {
            type: {
              name: 'array',
              value: {
                name: 'object',
                value: {
                  arr: numArrayType,
                  obj: boolObjectType,
                },
              },
            },
          },
        }
      )
    ).toStrictEqual({
      key: [
        {
          arr: [1, 2],
          obj: { bool: true },
        },
      ],
    });
  });
});

describe('combineArgs', () => {
  it('merges args', () => {
    expect(combineArgs({ foo: 1 }, { bar: 2 })).toStrictEqual({ foo: 1, bar: 2 });
  });

  it('merges sparse arrays', () => {
    expect(combineArgs({ foo: [1, 2, 3] }, { foo: [, 4, undefined] })).toStrictEqual({
      foo: [1, 4],
    });
  });

  it('deeply merges args', () => {
    expect(combineArgs({ foo: { bar: [1, 2], baz: true } }, { foo: { bar: [3] } })).toStrictEqual({
      foo: { bar: [3, 2], baz: true },
    });
  });

  it('omits keys with undefined value', () => {
    expect(combineArgs({ foo: 1 }, { foo: undefined })).toStrictEqual({});
  });
});

describe('validateOptions', () => {
  // https://github.com/storybookjs/storybook/issues/15630
  it('does not set args to `undefined` if they are unset', () => {
    expect(validateOptions({}, { a: {} })).toStrictEqual({});
  });

  it('omits arg and warns if value is not one of options', () => {
    expect(validateOptions({ a: 1 }, { a: { options: [2, 3] } })).toStrictEqual({});
    expect(once.warn).toHaveBeenCalledWith(
      "Received illegal value for 'a'. Supported options: 2, 3"
    );
  });

  it('includes arg if value is one of options', () => {
    expect(validateOptions({ a: 1 }, { a: { options: [1, 2] } })).toStrictEqual({ a: 1 });
  });

  // https://github.com/storybookjs/storybook/issues/17063
  it('does not set args to `undefined` if they are unset and there are options', () => {
    expect(validateOptions({}, { a: { options: [2, 3] } })).toStrictEqual({});
  });

  it('includes arg if value is undefined', () => {
    expect(validateOptions({ a: undefined }, { a: { options: [1, 2] } })).toStrictEqual({
      a: undefined,
    });
  });

  it('includes arg if no options are specified', () => {
    expect(validateOptions({ a: 1 }, { a: {} })).toStrictEqual({ a: 1 });
  });

  it('ignores options and logs an error if options is not an array', () => {
    // @ts-expect-error This should give TS error indeed (finally!)
    expect(validateOptions({ a: 1 }, { a: { options: { 2: 'two' } } })).toStrictEqual({ a: 1 });
    expect(once.error).toHaveBeenCalledWith(
      expect.stringContaining("Invalid argType: 'a.options' should be an array")
    );
  });

  it('logs an error if options contains non-primitive values', () => {
    expect(
      validateOptions({ a: { one: 1 } }, { a: { options: [{ one: 1 }, { two: 2 }] } })
    ).toStrictEqual({ a: { one: 1 } });
    expect(once.error).toHaveBeenCalledWith(
      expect.stringContaining("Invalid argType: 'a.options' should only contain primitives")
    );
    expect(once.warn).not.toHaveBeenCalled();
  });

  it('supports arrays', () => {
    expect(validateOptions({ a: [1, 2] }, { a: { options: [1, 2, 3] } })).toStrictEqual({
      a: [1, 2],
    });
    expect(validateOptions({ a: [1, 2, 4] }, { a: { options: [2, 3] } })).toStrictEqual({});
    expect(once.warn).toHaveBeenCalledWith(
      "Received illegal value for 'a[0]'. Supported options: 2, 3"
    );
  });
});

describe('groupArgsByTarget', () => {
  it('groups targeted args', () => {
    const groups = groupArgsByTarget({
      args: { a: 1, b: 2, c: 3 },
      argTypes: {
        a: { name: 'a', target: 'group1' },
        b: { name: 'b', target: 'group2' },
        c: { name: 'c', target: 'group2' },
      },
    });
    expect(groups).toEqual({
      group1: {
        a: 1,
      },
      group2: {
        b: 2,
        c: 3,
      },
    });
  });

  it('groups non-targetted args into a group with no name', () => {
    const groups = groupArgsByTarget({
      args: { a: 1, b: 2, c: 3 },
      argTypes: { a: { name: 'a' }, b: { name: 'b', target: 'group2' }, c: { name: 'c' } },
    });
    expect(groups).toEqual({
      [UNTARGETED]: {
        a: 1,
        c: 3,
      },
      group2: {
        b: 2,
      },
    });
  });
});
