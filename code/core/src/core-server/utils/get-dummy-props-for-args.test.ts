import { describe, expect, it } from 'vitest';

import {
  type ComponentArgTypesData,
  generateDummyPropsFromDocgen,
  generateDummyValueFromSBType,
} from './get-dummy-props-for-args';

describe('new-story-docgen', () => {
  describe('generateDummyValueFromSBType', () => {
    it('generates primitives', () => {
      expect(generateDummyValueFromSBType({ name: 'boolean' })).toBe(true);
      expect(generateDummyValueFromSBType({ name: 'number' })).toBe(42);
      expect(generateDummyValueFromSBType({ name: 'other', value: 'null' })).toBeNull();
      expect(generateDummyValueFromSBType({ name: 'other', value: 'void' })).toBeUndefined();
      expect(generateDummyValueFromSBType({ name: 'other', value: 'any' })).toBe('any');
      expect(generateDummyValueFromSBType({ name: 'other', value: 'unknown' })).toBe('unknown');
    });

    it('generates date', () => {
      expect(generateDummyValueFromSBType({ name: 'date' })).toEqual(new Date('2025-01-01'));
    });

    it('generates string values using token heuristics', () => {
      expect(generateDummyValueFromSBType({ name: 'string' }, 'backgroundColor')).toBe('#ff0000');
      expect(generateDummyValueFromSBType({ name: 'string' }, 'createdAt')).toBe('2025-01-01');
      expect(generateDummyValueFromSBType({ name: 'string' }, 'imageUrl')).toBe(
        'https://placehold.co/600x400?text=Storybook'
      );
      expect(generateDummyValueFromSBType({ name: 'string' }, 'websiteUrl')).toBe(
        'https://example.com'
      );
      expect(generateDummyValueFromSBType({ name: 'string' }, 'email')).toBe(
        'storybook@example.com'
      );
      expect(generateDummyValueFromSBType({ name: 'string' }, 'phoneNumber')).toBe('1234567890');
    });

    it('avoids image URL for image metadata props', () => {
      // image + width is penalized, so we fall back to the name.
      expect(generateDummyValueFromSBType({ name: 'string' }, 'imageWidth')).toBe('imageWidth');
    });

    it('generates node values using prop name', () => {
      expect(generateDummyValueFromSBType({ name: 'node' }, 'children')).toBe('children');
      expect(generateDummyValueFromSBType({ name: 'node' })).toBe('Hello world');
    });

    it('generates functions as placeholders', () => {
      expect(generateDummyValueFromSBType({ name: 'function' })).toBe('__function__');
    });

    it('generates object values recursively', () => {
      const type = {
        name: 'object' as const,
        value: {
          count: { name: 'number' as const },
          onClick: { name: 'function' as const },
        },
      };

      expect(generateDummyValueFromSBType(type)).toEqual({
        count: 42,
        onClick: '__function__',
      });
    });

    it('generates union values, preferring literals', () => {
      expect(
        generateDummyValueFromSBType({
          name: 'union',
          value: [{ name: 'literal', value: "'foo'" }, { name: 'string' }],
        })
      ).toBe('foo');

      expect(
        generateDummyValueFromSBType({
          name: 'union',
          value: [{ name: 'literal', value: '"bar"' }, { name: 'string' }],
        })
      ).toBe('bar');

      expect(generateDummyValueFromSBType({ name: 'union', value: [] })).toBe('');
    });

    it('generates array values', () => {
      expect(
        generateDummyValueFromSBType({ name: 'array', value: { name: 'other', value: 'X' } })
      ).toEqual([]);
      expect(generateDummyValueFromSBType({ name: 'array', value: { name: 'number' } })).toEqual([
        42,
      ]);
    });

    it('generates tuple values', () => {
      expect(
        generateDummyValueFromSBType({
          name: 'tuple',
          value: [{ name: 'string' }, { name: 'number' }],
        })
      ).toEqual(['Hello world', 42]);
    });

    it('generates other values conservatively', () => {
      expect(generateDummyValueFromSBType({ name: 'other', value: 'ReactMouseEvent' })).toBe(
        '__function__'
      );
      expect(generateDummyValueFromSBType({ name: 'other', value: 'Foo' })).toBe('Foo');
      expect(generateDummyValueFromSBType({ name: 'other', value: 'null' })).toBeNull();
    });
  });

  describe('generateMockPropsFromDocgen', () => {
    it('returns empty objects when docgen is missing', () => {
      expect(generateDummyPropsFromDocgen(null)).toEqual({ required: {}, optional: {} });
      expect(generateDummyPropsFromDocgen({})).toEqual({ required: {}, optional: {} });
      expect(generateDummyPropsFromDocgen({ props: {} })).toEqual({ required: {}, optional: {} });
    });

    it('splits required and optional props and uses prop names', () => {
      const docgen: ComponentArgTypesData = {
        props: {
          backgroundColor: { required: true, type: { name: 'string' } },
          websiteUrl: { required: false, type: { name: 'string' } },
          onClick: { required: true, type: { name: 'function' } },
          children: { required: false, type: { name: 'node', type: 'react' } },
        },
      };

      expect(generateDummyPropsFromDocgen(docgen)).toEqual({
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
