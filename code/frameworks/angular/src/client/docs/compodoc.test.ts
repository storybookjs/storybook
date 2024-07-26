import { describe, it, expect } from 'vitest';
import { extractType, setCompodocJson } from './compodoc';
import { CompodocJson, Decorator } from './types';

const makeProperty = (compodocType?: string) => ({
  type: compodocType,
  name: 'dummy',
  decorators: [] as Decorator[],
  optional: true,
});

const getDummyCompodocJson = () => {
  return {
    components: [
      {
        name: 'ButtonComponent',
        type: 'component',
        propertiesClass: [],
        inputsClass: [
          {
            required: true,
            name: 'label',
            defaultValue: "'Button'",
            type: 'string',
            decorators: [],
          },
          {
            name: 'primary',
            defaultValue: 'false',
            deprecated: false,
            deprecationMessage: '',
            line: 23,
            type: 'boolean',
            decorators: [],
          },
        ],
        outputsClass: [],
        methodsClass: [],
      },
    ],
    miscellaneous: {
      typealiases: [
        {
          name: 'EnumAlias',
          ctype: 'miscellaneous',
          subtype: 'typealias',
          rawtype: 'EnumNumeric',
          file: 'src/stories/component-with-enums/enums.component.ts',
          description: '',
          kind: 161,
        },
        {
          name: 'TypeAlias',
          ctype: 'miscellaneous',
          subtype: 'typealias',
          rawtype: '"Type Alias 1" | "Type Alias 2" | "Type Alias 3"',
          file: 'src/stories/component-with-enums/enums.component.ts',
          description: '',
          kind: 168,
        },
      ],
      enumerations: [
        {
          name: 'EnumNumeric',
          childs: [
            {
              name: 'FIRST',
            },
            {
              name: 'SECOND',
            },
            {
              name: 'THIRD',
            },
          ],
          ctype: 'miscellaneous',
          subtype: 'enum',
          description: '<p>Button Priority</p>\n',
          file: 'src/stories/component-with-enums/enums.component.ts',
        },
        {
          name: 'EnumNumericInitial',
          childs: [
            {
              name: 'UNO',
              value: '1',
            },
            {
              name: 'DOS',
            },
            {
              name: 'TRES',
            },
          ],
          ctype: 'miscellaneous',
          subtype: 'enum',
          description: '',
          file: 'src/stories/component-with-enums/enums.component.ts',
        },
        {
          name: 'EnumStringValues',
          childs: [
            {
              name: 'PRIMARY',
              value: 'PRIMARY',
            },
            {
              name: 'SECONDARY',
              value: 'SECONDARY',
            },
            {
              name: 'TERTIARY',
              value: 'TERTIARY',
            },
          ],
          ctype: 'miscellaneous',
          subtype: 'enum',
          description: '',
          file: 'src/stories/component-with-enums/enums.component.ts',
        },
      ],
    },
  } as CompodocJson;
};

describe('extractType', () => {
  describe('with compodoc type', () => {
    setCompodocJson(getDummyCompodocJson());
    it.each([
      ['string', { name: 'string' }],
      ['boolean', { name: 'boolean' }],
      ['number', { name: 'number' }],
      // ['object', { name: 'object' }], // seems to be wrong | TODO: REVISIT
      // ['foo', { name: 'other', value: 'empty-enum' }], // seems to be wrong | TODO: REVISIT
      [null, { name: 'other', value: 'void' }],
      [undefined, { name: 'other', value: 'void' }],
      // ['T[]', { name: 'other', value: 'empty-enum' }], // seems to be wrong | TODO: REVISIT
      ['[]', { name: 'other', value: 'empty-enum' }],
      ['"primary" | "secondary"', { name: 'enum', value: ['primary', 'secondary'] }],
      ['TypeAlias', { name: 'enum', value: ['Type Alias 1', 'Type Alias 2', 'Type Alias 3'] }],
      // ['EnumNumeric', { name: 'other', value: 'empty-enum' }], // seems to be wrong | TODO: REVISIT
      // ['EnumNumericInitial', { name: 'other', value: 'empty-enum' }], // seems to be wrong | TODO: REVISIT
      ['EnumStringValues', { name: 'enum', value: ['PRIMARY', 'SECONDARY', 'TERTIARY'] }],
    ])('%s', (compodocType, expected) => {
      expect(extractType(makeProperty(compodocType), null)).toEqual(expected);
    });
  });

  describe('without compodoc type', () => {
    it.each([
      ['string', { name: 'string' }],
      ['', { name: 'string' }],
      [false, { name: 'boolean' }],
      [10, { name: 'number' }],
      // [['abc'], { name: 'object' }], // seems to be wrong | TODO: REVISIT
      // [{ foo: 1 }, { name: 'other', value: 'empty-enum' }], // seems to be wrong | TODO: REVISIT
      [undefined, { name: 'other', value: 'void' }],
    ])('%s', (defaultValue, expected) => {
      expect(extractType(makeProperty(null), defaultValue)).toEqual(expected);
    });
  });
});
