import { shouldPreserveExistingValue, safeAssignProperties } from './SignalUtils';
import { describe, it, expect, vi } from 'vitest';

// Simple test suite for SignalUtils
describe('SignalUtils', () => {
  describe('shouldPreserveExistingValue', () => {
    it('should preserve functions when new value is not a function', () => {
      const existingFunction = () => 'test';
      const newValue = 'not a function';

      expect(shouldPreserveExistingValue(existingFunction, newValue)).toBe(true);
    });

    it('should preserve functions when new value is an array', () => {
      const existingFunction = () => ['child1', 'child2'];
      const newValue = ['should', 'not', 'overwrite'];

      expect(shouldPreserveExistingValue(existingFunction, newValue)).toBe(true);
    });

    it('should allow function to function assignment', () => {
      const existingFunction = () => 'old';
      const newFunction = () => 'new';

      expect(shouldPreserveExistingValue(existingFunction, newFunction)).toBe(false);
    });

    it('should allow non-function assignments', () => {
      const existingValue = 'string';
      const newValue = 'new string';

      expect(shouldPreserveExistingValue(existingValue, newValue)).toBe(false);
    });
  });

  describe('safeAssignProperties', () => {
    it('should assign non-function properties normally', () => {
      const target = { a: 1, b: 'old' };
      const source = { b: 'new', c: 3 };

      safeAssignProperties(target, source);

      expect(target).toEqual({ a: 1, b: 'new', c: 3 });
    });

    it('should preserve function properties when source has non-functions', () => {
      const mockContentChildren = vi.fn(() => ['child1', 'child2']);
      const target = {
        normalProp: 'original',
        contentChildren: mockContentChildren,
      };
      const source = {
        normalProp: 'updated',
        contentChildren: ['should', 'not', 'overwrite'],
      };

      safeAssignProperties(target, source);

      expect(target.normalProp).toBe('updated');
      expect(target.contentChildren).toBe(mockContentChildren);
    });

    it('should allow function to function assignment', () => {
      const oldFunction = () => 'old';
      const newFunction = () => 'new';
      const target = { func: oldFunction };
      const source = { func: newFunction };

      safeAssignProperties(target, source);

      expect(target.func).toBe(newFunction);
    });

    it('should handle null/undefined gracefully', () => {
      const target = { a: 1 };

      expect(() => {
        safeAssignProperties(target, null);
        safeAssignProperties(target, undefined);
        safeAssignProperties(null, { b: 2 });
        safeAssignProperties(undefined, { b: 2 });
      }).not.toThrow();

      expect(target).toEqual({ a: 1 });
    });

    it('should simulate the Angular contentChildren scenario', () => {
      // Mock Angular contentChildren signal
      const mockContentChildrenSignal = vi.fn(() => [{ name: 'Child1' }, { name: 'Child2' }]);
      // Add Angular-like properties
      Object.defineProperty(mockContentChildrenSignal, 'constructor', {
        value: { name: 'Signal' },
      });

      // Simulate component with contentChildren
      const component = {
        title: 'Test Component',
        options: mockContentChildrenSignal,
        visible: true,
      };

      // Simulate Storybook trying to assign props that include the signal value as array
      const storyProps = {
        title: 'Updated Component',
        options: [{ name: 'Child1' }, { name: 'Child2' }], // This should NOT overwrite signal
        visible: false,
        newProp: 'added',
      };

      safeAssignProperties(component, storyProps);

      // Verify that signal is preserved and can still be called
      expect(component.title).toBe('Updated Component');
      expect(component.options).toBe(mockContentChildrenSignal);
      expect(typeof component.options).toBe('function');
      expect(component.options()).toEqual([{ name: 'Child1' }, { name: 'Child2' }]);
      expect(component.visible).toBe(false);
      expect((component as any).newProp).toBe('added');
    });
  });
});
