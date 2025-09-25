import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ComponentInfo,
  checkComponentsAgainstIndex,
  findComponentsInDOM,
  generateSelectorsForComponents,
  groupComponentsByStoryStatus,
} from '../story-matcher';

// Mock DOM
global.document = {
  querySelectorAll: vi.fn(),
} as any;

describe('story-matcher', () => {
  describe('checkComponentsAgainstIndex', () => {
    it('should match components against story index', () => {
      const components: ComponentInfo[] = [
        {
          element: {} as Element,
          componentPath: '/src/components/Button.tsx',
          hasStory: false,
        },
        {
          element: {} as Element,
          componentPath: '/src/components/Input.tsx',
          hasStory: false,
        },
      ];

      const storyIndex = {
        entries: {
          'button--default': {
            id: 'button--default',
            title: 'Button',
            name: 'Default',
            componentPath: '/src/components/Button.tsx',
          },
        },
      };

      const result = checkComponentsAgainstIndex(components, storyIndex.entries as any);

      expect(result[0].hasStory).toBe(true);
      expect(result[0].storyId).toBe('button--default');
      expect(result[1].hasStory).toBe(false);
    });

    it('should normalize paths for comparison', () => {
      const components: ComponentInfo[] = [
        {
          element: {} as Element,
          componentPath: '/src\\components\\Button.tsx', // Windows path
          hasStory: false,
        },
      ];

      const storyIndex = {
        entries: {
          'button--default': {
            id: 'button--default',
            title: 'Button',
            name: 'Default',
            componentPath: '/src/components/Button.tsx', // Unix path
          },
        },
      };

      const result = checkComponentsAgainstIndex(components, storyIndex.entries as any);

      expect(result[0].hasStory).toBe(true);
    });
  });

  describe('groupComponentsByStoryStatus', () => {
    it('should group components by story status', () => {
      const components: ComponentInfo[] = [
        {
          element: {} as Element,
          componentPath: '/src/components/Button.tsx',
          hasStory: true,
          storyId: 'button--default',
        },
        {
          element: {} as Element,
          componentPath: '/src/components/Input.tsx',
          hasStory: false,
        },
      ];

      const result = groupComponentsByStoryStatus(components);

      expect(result.withStories).toHaveLength(1);
      expect(result.withoutStories).toHaveLength(1);
      expect(result.withStories[0].componentPath).toBe('/src/components/Button.tsx');
      expect(result.withoutStories[0].componentPath).toBe('/src/components/Input.tsx');
    });
  });

  describe('findComponentsInDOM', () => {
    it('should deduplicate components with same path', () => {
      // Mock the preview iframe and its document
      const mockElement1 = { getAttribute: vi.fn().mockReturnValue('./src/Button.tsx') };
      const mockElement2 = { getAttribute: vi.fn().mockReturnValue('./src/Button.tsx') }; // Same path
      const mockElement3 = { getAttribute: vi.fn().mockReturnValue('./src/Input.tsx') }; // Different path

      const mockContentDocument = {
        querySelectorAll: vi.fn().mockReturnValue([mockElement1, mockElement2, mockElement3]),
      };

      const mockIframe = {
        contentDocument: mockContentDocument,
        contentWindow: { document: mockContentDocument },
      };

      // Mock DOM
      global.document = {
        getElementById: vi.fn().mockReturnValue(mockIframe),
      } as any;

      const result = findComponentsInDOM();

      // Should only have 2 components (deduplicated)
      expect(result).toHaveLength(2);
      expect(result[0].componentPath).toBe('./src/Button.tsx');
      expect(result[1].componentPath).toBe('./src/Input.tsx');
      // Should use the first element found for each path
      expect(result[0].element).toBe(mockElement1);
    });
  });

  describe('generateSelectorsForComponents', () => {
    it('should generate CSS selectors for components', () => {
      const components: ComponentInfo[] = [
        {
          element: {
            tagName: 'BUTTON',
            getAttribute: () => '/src/components/Button.tsx',
          } as any,
          componentPath: '/src/components/Button.tsx',
          hasStory: false,
        },
      ];

      const result = generateSelectorsForComponents(components);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('button[data-sb-component-path="/src/components/Button.tsx"]');
    });
  });
});
