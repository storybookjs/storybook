import { describe, expect, test } from 'vitest';
import { extractProperRendererNameFromFramework } from './get-renderer-name';

describe('get-renderer-name', () => {
  describe('extractProperRendererNameFromFramework', () => {
    test('should return the renderer name for a known framework', async () => {
      const renderer = await extractProperRendererNameFromFramework('@storybook/react-vite');
      expect(renderer).toEqual('react');
    });

    test('should return null for an unknown framework', async () => {
      const renderer = await extractProperRendererNameFromFramework('@third-party/framework');
      expect(renderer).toBeNull();
    });
  });
});
