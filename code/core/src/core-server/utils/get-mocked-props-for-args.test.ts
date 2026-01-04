import { describe, expect, it } from 'vitest';

import {
  type ComponentArgTypesData,
  generateMockPropsFromDocgen,
  generateMockValueFromSBType,
} from './get-mocked-props-for-args';

describe('new-story-docgen', () => {
  describe('generateMockValueFromSBType', () => {
    it('generates primitives', () => {
      expect(generateMockValueFromSBType({ name: 'boolean' })).toBe(true);
      expect(generateMockValueFromSBType({ name: 'number' })).toBe(42);
      expect(generateMockValueFromSBType({ name: 'other', value: 'null' })).toBeNull();
      expect(generateMockValueFromSBType({ name: 'other', value: 'void' })).toBeUndefined();
      expect(generateMockValueFromSBType({ name: 'other', value: 'any' })).toBe('any');
      expect(generateMockValueFromSBType({ name: 'other', value: 'unknown' })).toBe('unknown');
    });

    it('generates date', () => {
      expect(generateMockValueFromSBType({ name: 'date' })).toEqual(new Date('2025-01-01'));
    });

    it('generates string values using token heuristics', () => {
      expect(generateMockValueFromSBType({ name: 'string' }, 'backgroundColor')).toBe('#ff0000');
      expect(generateMockValueFromSBType({ name: 'string' }, 'createdAt')).toBe('2025-01-01');
      expect(generateMockValueFromSBType({ name: 'string' }, 'imageUrl')).toBe(
        'https://placehold.co/600x400?text=Storybook'
      );
      expect(generateMockValueFromSBType({ name: 'string' }, 'websiteUrl')).toBe(
        'https://example.com'
      );
      expect(generateMockValueFromSBType({ name: 'string' }, 'email')).toBe(
        'storybook@example.com'
      );
      expect(generateMockValueFromSBType({ name: 'string' }, 'phoneNumber')).toBe('1234567890');
    });

    it('avoids image URL for image metadata props', () => {
      // image + width is penalized, so we fall back to the name.
      expect(generateMockValueFromSBType({ name: 'string' }, 'imageWidth')).toBe('imageWidth');
    });

    it('generates node values using prop name', () => {
      expect(generateMockValueFromSBType({ name: 'node', renderer: 'react' }, 'children')).toBe(
        'children'
      );
      expect(generateMockValueFromSBType({ name: 'node', renderer: 'react' })).toBe('Hello world');
    });

    it('generates functions as placeholders', () => {
      expect(generateMockValueFromSBType({ name: 'function' })).toBe('__function__');
    });

    it('generates object values recursively', () => {
      const type = {
        name: 'object' as const,
        value: {
          count: { name: 'number' as const },
          onClick: { name: 'function' as const },
        },
      };

      expect(generateMockValueFromSBType(type)).toEqual({
        count: 42,
        onClick: '__function__',
      });
    });

    it('generates union values, preferring literals', () => {
      expect(
        generateMockValueFromSBType({
          name: 'union',
          value: [{ name: 'literal', value: "'foo'" }, { name: 'string' }],
        })
      ).toBe('foo');

      expect(
        generateMockValueFromSBType({
          name: 'union',
          value: [{ name: 'literal', value: '"bar"' }, { name: 'string' }],
        })
      ).toBe('bar');

      expect(generateMockValueFromSBType({ name: 'union', value: [] })).toBe('');
    });

    it('generates array values', () => {
      expect(
        generateMockValueFromSBType({ name: 'array', value: { name: 'other', value: 'X' } })
      ).toEqual([]);
      expect(generateMockValueFromSBType({ name: 'array', value: { name: 'number' } })).toEqual([
        42,
      ]);
    });

    it('generates tuple values', () => {
      expect(
        generateMockValueFromSBType({
          name: 'tuple',
          value: [{ name: 'string' }, { name: 'number' }],
        })
      ).toEqual(['Hello world', 42]);
    });

    it('generates other values conservatively', () => {
      expect(generateMockValueFromSBType({ name: 'other', value: 'ReactMouseEvent' })).toBe(
        '__function__'
      );
      expect(generateMockValueFromSBType({ name: 'other', value: 'Foo' })).toBe('Foo');
      expect(generateMockValueFromSBType({ name: 'other', value: 'null' })).toBeNull();
    });
  });

  describe('generateMockPropsFromDocgen', () => {
    it('returns empty objects when docgen is missing', () => {
      expect(generateMockPropsFromDocgen(null)).toEqual({ required: {}, optional: {} });
      expect(generateMockPropsFromDocgen({})).toEqual({ required: {}, optional: {} });
      expect(generateMockPropsFromDocgen({ props: {} })).toEqual({ required: {}, optional: {} });
    });

    it('splits required and optional props and uses prop names', () => {
      const docgen: ComponentArgTypesData = {
        props: {
          backgroundColor: { required: true, type: { name: 'string' } },
          websiteUrl: { required: false, type: { name: 'string' } },
          onClick: { required: true, type: { name: 'function' } },
          children: { required: false, type: { name: 'node', renderer: 'react' } },
        },
      };

      expect(generateMockPropsFromDocgen(docgen)).toEqual({
        required: {
          backgroundColor: '#ff0000',
          onClick: '__function__',
        },
        optional: {
          websiteUrl: 'https://example.com',
          children: 'children',
        },
      });
    });
  });
});
