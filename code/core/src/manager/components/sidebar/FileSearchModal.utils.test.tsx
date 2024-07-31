import { describe, expect, it } from 'vitest';
import { extractSeededRequiredArgs } from './FileSearchModal.utils';
import type { ArgTypes } from '@storybook/csf';

describe('FileSearchModal.utils', () => {
  describe('extractSeededRequiredArgs', () => {
    it('should extract seeded required args', () => {
      const argTypes = {
        string: {
          type: { name: 'string', required: true },
        },
        stringOptional: {
          type: { name: 'string', required: false },
        },
        number: {
          type: { name: 'number', required: true },
        },
        boolean: {
          type: { name: 'boolean', required: true },
        },
        function: {
          type: { name: 'function', required: true },
        },
        object: {
          type: {
            name: 'object',
            required: true,
            value: {
              a: { name: 'string', required: true },
              b: { name: 'number' },
            },
          },
        },
        union: {
          type: {
            name: 'union',
            required: true,
            value: [{ name: 'string', required: true }, { name: 'number' }],
          },
        },
        enum: {
          type: {
            name: 'enum',
            required: true,
            value: ['a', 'b', 'c'],
          },
          options: ['a', 'b', 'c'],
        },
        otherObject: {
          type: { name: 'other', required: true, value: '' },
          control: { type: 'object' },
        },
        otherInlineRadio: {
          type: { name: 'other', required: true, value: '' },
          control: { type: 'inline-radio', options: ['a', 'b', 'c'] },
        },
        otherRadio: {
          type: { name: 'other', required: true, value: '' },
          control: { type: 'radio', options: ['d', 'e', 'f'] },
        },
        otherInlineCheck: {
          type: { name: 'other', required: true, value: '' },
          control: { type: 'inline-check', options: ['g', 'h', 'i'] },
        },
        otherCheck: {
          type: { name: 'other', required: true, value: '' },
          control: { type: 'check', options: ['j', 'k', 'l'] },
        },
        otherSelect: {
          type: { name: 'other', required: true, value: '' },
          control: { type: 'select', options: ['m', 'n', 'o'] },
        },
        otherMultiSelect: {
          type: { name: 'other', required: true, value: '' },
          control: { type: 'multi-select', options: ['p', 'q', 'r'] },
        },
        otherColor: {
          type: { name: 'other', required: true, value: '' },
          control: { type: 'color' },
        },
        intersection: {
          type: {
            name: 'intersection',
            required: true,
            value: [
              {
                name: 'object',
                value: {
                  a: { name: 'string', required: true },
                  b: { name: 'number' },
                },
              },
            ],
          },
        },
        tuple: {
          type: {
            name: 'other',
            required: true,
            value: 'tuple',
          },
        },
      } as ArgTypes;

      expect(extractSeededRequiredArgs(argTypes)).toEqual({
        boolean: true,
        function: expect.any(Function),
        number: 0,
        enum: 'a',
        otherCheck: 'j',
        otherColor: '#000000',
        otherInlineCheck: 'g',
        otherInlineRadio: 'a',
        otherMultiSelect: 'p',
        otherObject: {},
        otherRadio: 'd',
        otherSelect: 'm',
        string: 'string',
        object: { a: 'a' },
        union: 'union',
        intersection: { a: 'a' },
        tuple: [],
      });
    });
  });
});
