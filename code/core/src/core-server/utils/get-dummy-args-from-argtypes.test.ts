import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  generateDummyArgsFromArgTypes,
  generateDummyValueFromSBType,
} from './get-dummy-args-from-argtypes';

describe('new-story-docgen', () => {
  const MOCK_DATE = new Date('2025-01-01T00:00:00.000Z');
  beforeEach(() => {
    vi.setSystemTime(MOCK_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateDummyValueFromSBType', () => {
    it('generates primitives', () => {
      expect(generateDummyValueFromSBType({ name: 'boolean' })).toBe(true);
      expect(generateDummyValueFromSBType({ name: 'number' })).toBe(0);
      expect(generateDummyValueFromSBType({ name: 'other', value: 'null' })).toBeNull();
      expect(generateDummyValueFromSBType({ name: 'other', value: 'void' })).toBeUndefined();
      expect(generateDummyValueFromSBType({ name: 'other', value: 'any' })).toBe('any');
      expect(generateDummyValueFromSBType({ name: 'other', value: 'unknown' })).toBe('unknown');
    });

    it('generates date', () => {
      expect(generateDummyValueFromSBType({ name: 'date' })).toEqual(MOCK_DATE);
    });

    it('generates string values using token heuristics', () => {
      expect(generateDummyValueFromSBType({ name: 'string' }, 'backgroundColor')).toBe('#ff4785');
      expect(generateDummyValueFromSBType({ name: 'string' }, 'createdAt')).toBe(
        MOCK_DATE.toLocaleDateString()
      );
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
      expect(generateDummyValueFromSBType({ name: 'node', renderer: 'react' }, 'children')).toBe(
        'children'
      );
      expect(generateDummyValueFromSBType({ name: 'node', renderer: 'react' })).toBe('Hello world');
    });

    it('generates functions as placeholders', () => {
      expect(generateDummyValueFromSBType({ name: 'function' })).toBe(
        '[[STORYBOOK_FN_PLACEHOLDER]]'
      );
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
        count: 0,
        onClick: '[[STORYBOOK_FN_PLACEHOLDER]]',
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
        0,
      ]);
    });

    it('generates tuple values', () => {
      expect(
        generateDummyValueFromSBType({
          name: 'tuple',
          value: [{ name: 'string' }, { name: 'number' }],
        })
      ).toEqual(['', 0]);
    });

    it('generates other values conservatively', () => {
      expect(generateDummyValueFromSBType({ name: 'other', value: 'ReactMouseEvent' })).toBe(
        '[[STORYBOOK_FN_PLACEHOLDER]]'
      );
      expect(generateDummyValueFromSBType({ name: 'other', value: 'Foo' })).toBe('Foo');
      expect(generateDummyValueFromSBType({ name: 'other', value: 'null' })).toBeNull();
    });
  });

  describe('generateDummyArgsFromArgTypes', () => {
    it('skips URL generation when skipUrlGeneration option is true', () => {
      const argTypes = {
        imageUrl: {
          type: { name: 'string' },
        },
        websiteUrl: {
          type: { name: 'string' },
        },
      } as any;

      // With skipUrlGeneration: false (default behavior)
      const resultWithUrls = generateDummyArgsFromArgTypes(argTypes, { skipUrlGeneration: false });
      expect(resultWithUrls.optional.imageUrl).toBe('https://placehold.co/600x400?text=Storybook');
      expect(resultWithUrls.optional.websiteUrl).toBe('https://example.com');

      // With skipUrlGeneration: true
      const resultWithoutUrls = generateDummyArgsFromArgTypes(argTypes, {
        skipUrlGeneration: true,
      });
      expect(resultWithoutUrls.optional.imageUrl).toBe('imageUrl');
      expect(resultWithoutUrls.optional.websiteUrl).toBe('websiteUrl');
    });
  });
});
