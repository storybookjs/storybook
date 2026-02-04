import { describe, expect, it } from 'vitest';

import { groupBy, invariant } from './utils';

describe('utils', () => {
  describe('groupBy', () => {
    it('should group items by a key selector', () => {
      const items = [
        { type: 'fruit', name: 'apple' },
        { type: 'vegetable', name: 'carrot' },
        { type: 'fruit', name: 'banana' },
        { type: 'vegetable', name: 'broccoli' },
      ];

      const result = groupBy(items, (item) => item.type);

      expect(result).toEqual({
        fruit: [
          { type: 'fruit', name: 'apple' },
          { type: 'fruit', name: 'banana' },
        ],
        vegetable: [
          { type: 'vegetable', name: 'carrot' },
          { type: 'vegetable', name: 'broccoli' },
        ],
      });
    });

    it('should handle empty arrays', () => {
      const result = groupBy([], (item) => item);

      expect(result).toEqual({});
    });

    it('should handle single item', () => {
      const items = [{ type: 'fruit', name: 'apple' }];

      const result = groupBy(items, (item) => item.type);

      expect(result).toEqual({
        fruit: [{ type: 'fruit', name: 'apple' }],
      });
    });

    it('should pass index to key selector', () => {
      const items = ['a', 'b', 'c', 'd'];
      const indices: number[] = [];

      groupBy(items, (_item, index) => {
        indices.push(index);
        return index % 2 === 0 ? 'even' : 'odd';
      });

      expect(indices).toEqual([0, 1, 2, 3]);
    });

    it('should group by index when key selector uses index', () => {
      const items = ['a', 'b', 'c', 'd'];

      const result = groupBy(items, (_item, index) => (index % 2 === 0 ? 'even' : 'odd'));

      expect(result).toEqual({
        even: ['a', 'c'],
        odd: ['b', 'd'],
      });
    });

    it('should handle numeric keys', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 1 }];

      const result = groupBy(items, (item) => item.id);

      expect(result).toEqual({
        1: [{ id: 1 }, { id: 1 }],
        2: [{ id: 2 }],
      });
    });

    it('should handle symbol keys', () => {
      const key1 = Symbol('key1');
      const key2 = Symbol('key2');
      const items = [
        { key: key1, value: 'a' },
        { key: key2, value: 'b' },
        { key: key1, value: 'c' },
      ];

      const result = groupBy(items, (item) => item.key);

      expect(result[key1]).toEqual([
        { key: key1, value: 'a' },
        { key: key1, value: 'c' },
      ]);
      expect(result[key2]).toEqual([{ key: key2, value: 'b' }]);
    });

    it('should handle all items with same key', () => {
      const items = ['a', 'b', 'c'];

      const result = groupBy(items, () => 'same');

      expect(result).toEqual({
        same: ['a', 'b', 'c'],
      });
    });
  });

  describe('invariant', () => {
    it('should not throw when condition is truthy', () => {
      expect(() => {
        invariant(true, 'Error message');
      }).not.toThrow();

      expect(() => {
        invariant(1, 'Error message');
      }).not.toThrow();

      expect(() => {
        invariant('non-empty', 'Error message');
      }).not.toThrow();

      expect(() => {
        invariant({}, 'Error message');
      }).not.toThrow();

      expect(() => {
        invariant([], 'Error message');
      }).not.toThrow();
    });

    it('should throw when condition is falsy', () => {
      expect(() => {
        invariant(false, 'Error message');
      }).toThrow('Error message');

      expect(() => {
        invariant(0, 'Zero is falsy');
      }).toThrow('Zero is falsy');

      expect(() => {
        invariant('', 'Empty string is falsy');
      }).toThrow('Empty string is falsy');

      expect(() => {
        invariant(null, 'Null is falsy');
      }).toThrow('Null is falsy');

      expect(() => {
        invariant(undefined, 'Undefined is falsy');
      }).toThrow('Undefined is falsy');
    });

    it('should throw with default message when no message provided', () => {
      expect(() => {
        invariant(false);
      }).toThrow('Invariant failed');
    });

    it('should support lazy message evaluation with function', () => {
      let messageEvaluated = false;

      // Should not evaluate message when condition is true
      invariant(true, () => {
        messageEvaluated = true;
        return 'This should not be evaluated';
      });

      expect(messageEvaluated).toBe(false);
    });

    it('should evaluate lazy message when condition is false', () => {
      let messageEvaluated = false;

      expect(() => {
        invariant(false, () => {
          messageEvaluated = true;
          return 'Lazy evaluated message';
        });
      }).toThrow('Lazy evaluated message');

      expect(messageEvaluated).toBe(true);
    });

    it('should allow expensive message computation only when needed', () => {
      const expensiveComputation = () => {
        return Array.from({ length: 1000 })
          .map((_, i) => `Item ${i}`)
          .join(', ');
      };

      // This should be fast because the message is not computed
      expect(() => {
        invariant(true, expensiveComputation);
      }).not.toThrow();

      // This should compute the message
      expect(() => {
        invariant(false, expensiveComputation);
      }).toThrow(/Item 0/);
    });

    it('should handle complex conditions', () => {
      const obj = { value: 42 };

      expect(() => {
        invariant(obj.value > 0, 'Value must be positive');
      }).not.toThrow();

      expect(() => {
        invariant(obj.value < 0, 'Value must be negative');
      }).toThrow('Value must be negative');
    });

    it('should narrow types with type assertion', () => {
      function processValue(value: string | null): string {
        invariant(value !== null, 'Value must not be null');
        // TypeScript should now know that value is string, not string | null
        return value.toUpperCase();
      }

      expect(processValue('test')).toBe('TEST');
      expect(() => processValue(null)).toThrow('Value must not be null');
    });
  });
});

