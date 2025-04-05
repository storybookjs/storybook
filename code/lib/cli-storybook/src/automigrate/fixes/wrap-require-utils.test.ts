import { describe, expect, it, vi } from 'vitest';

import { types as t } from 'storybook/internal/babel';
import type { ConfigFile } from 'storybook/internal/csf-tools';

import { wrapValueWithRequireWrapper } from './wrap-require-utils';

describe('wrap-require-utils', () => {
  describe('wrapValueWithRequireWrapper', () => {
    it('should not wrap @storybook/addon-svelte-csf', () => {
      // Create a mock config
      const mockConfig = {
        getFieldNode: vi.fn(),
        getBodyDeclarations: vi.fn().mockReturnValue([]),
      } as unknown as ConfigFile;

      // Create an array with svelte-csf and other addons
      const node = t.arrayExpression([
        t.stringLiteral('@storybook/addon-themes'),
        t.stringLiteral('@storybook/addon-svelte-csf'),
        t.stringLiteral('@storybook/addon-a11y'),
      ]);

      // Apply the wrapper
      wrapValueWithRequireWrapper(mockConfig, node);

      // Check that svelte-csf is not wrapped
      const svelteCsfElement = node.elements[1] as t.StringLiteral;
      expect(svelteCsfElement.value).toBe('@storybook/addon-svelte-csf');

      // Check that other addons are wrapped
      expect(t.isCallExpression(node.elements[0])).toBe(true);
      expect(t.isCallExpression(node.elements[2])).toBe(true);
    });
  });
});
