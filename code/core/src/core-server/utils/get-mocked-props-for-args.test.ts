import { describe, expect, it } from 'vitest';

import {
  type ComponentDocgenData,
  type ComponentDocgenPropType,
  generateMockPropsFromDocgen,
  generateMockValueFromDocgenType,
} from './get-mocked-props-for-args';

describe('new-story-docgen', () => {
  describe('generateMockValueFromDocgenType', () => {
    it('generates primitives', () => {
      expect(generateMockValueFromDocgenType({ kind: 'boolean' })).toBe(true);
      expect(generateMockValueFromDocgenType({ kind: 'number' })).toBe(42);
      expect(generateMockValueFromDocgenType({ kind: 'null' })).toBeNull();
      expect(generateMockValueFromDocgenType({ kind: 'void' })).toBeUndefined();
      expect(generateMockValueFromDocgenType({ kind: 'any' })).toBe('any');
      expect(generateMockValueFromDocgenType({ kind: 'unknown' })).toBe('unknown');
    });

    it('generates date', () => {
      expect(generateMockValueFromDocgenType({ kind: 'date' })).toEqual(new Date('2025-01-01'));
    });

    it('generates string values using token heuristics', () => {
      expect(generateMockValueFromDocgenType({ kind: 'string' }, 'backgroundColor')).toBe(
        '#ff0000'
      );
      expect(generateMockValueFromDocgenType({ kind: 'string' }, 'createdAt')).toBe('2025-01-01');
      expect(generateMockValueFromDocgenType({ kind: 'string' }, 'imageUrl')).toBe(
        'https://placehold.co/600x400?text=Storybook'
      );
      expect(generateMockValueFromDocgenType({ kind: 'string' }, 'websiteUrl')).toBe(
        'https://example.com'
      );
      expect(generateMockValueFromDocgenType({ kind: 'string' }, 'email')).toBe(
        'storybook@example.com'
      );
      expect(generateMockValueFromDocgenType({ kind: 'string' }, 'phoneNumber')).toBe('1234567890');
    });

    it('avoids image URL for image metadata props', () => {
      // image + width is penalized, so we fall back to the name.
      expect(generateMockValueFromDocgenType({ kind: 'string' }, 'imageWidth')).toBe('imageWidth');
    });

    it('generates node values (react) using prop name', () => {
      expect(generateMockValueFromDocgenType({ kind: 'node', renderer: 'react' }, 'children')).toBe(
        'children'
      );
      expect(generateMockValueFromDocgenType({ kind: 'node', renderer: 'react' })).toBe(
        'Hello world'
      );
    });

    it('generates functions as placeholders', () => {
      expect(generateMockValueFromDocgenType({ kind: 'function' })).toBe('__function__');
    });

    it('generates object values recursively', () => {
      const type: ComponentDocgenPropType = {
        kind: 'object',
        properties: {
          count: { kind: 'number' },
          onClick: { kind: 'function' },
        },
      };

      expect(generateMockValueFromDocgenType(type)).toEqual({
        count: 42,
        onClick: '__function__',
      });
    });

    it('generates union values, preferring literals', () => {
      expect(
        generateMockValueFromDocgenType({
          kind: 'union',
          elements: [{ kind: 'literal', value: "'foo'" }, { kind: 'string' }],
        })
      ).toBe('foo');

      expect(
        generateMockValueFromDocgenType({
          kind: 'union',
          elements: [{ kind: 'literal', value: '"bar"' }, { kind: 'string' }],
        })
      ).toBe('bar');

      expect(generateMockValueFromDocgenType({ kind: 'union', elements: [] })).toBe('');
    });

    it('generates array values', () => {
      expect(
        generateMockValueFromDocgenType({ kind: 'array', element: { kind: 'other', name: 'X' } })
      ).toEqual([]);
      expect(
        generateMockValueFromDocgenType({ kind: 'array', element: { kind: 'number' } })
      ).toEqual([42]);
    });

    it('generates tuple values', () => {
      expect(
        generateMockValueFromDocgenType({
          kind: 'tuple',
          elements: [{ kind: 'string' }, { kind: 'number' }],
        })
      ).toEqual(['Hello world', 42]);
    });

    it('generates other values conservatively', () => {
      expect(generateMockValueFromDocgenType({ kind: 'other', name: 'ReactMouseEvent' })).toBe(
        '__function__'
      );
      expect(generateMockValueFromDocgenType({ kind: 'other', name: 'Foo' })).toBe('Foo');
      expect(generateMockValueFromDocgenType({ kind: 'other' })).toBeNull();
    });
  });

  describe('generateMockPropsFromDocgen', () => {
    it('returns empty objects when docgen is missing', () => {
      expect(generateMockPropsFromDocgen(null)).toEqual({ required: {}, optional: {} });
      expect(generateMockPropsFromDocgen({})).toEqual({ required: {}, optional: {} });
      expect(generateMockPropsFromDocgen({ props: {} })).toEqual({ required: {}, optional: {} });
    });

    it('splits required and optional props and uses prop names', () => {
      const docgen: ComponentDocgenData = {
        props: {
          backgroundColor: { required: true, type: { kind: 'string' } },
          websiteUrl: { required: false, type: { kind: 'string' } },
          onClick: { required: true, type: { kind: 'function' } },
          children: { required: false, type: { kind: 'node', renderer: 'react' } },
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
