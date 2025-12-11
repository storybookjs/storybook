import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IndexerOptions } from 'storybook/internal/types';

import { createGhostStoriesIndexer } from '../ghost-stories-indexer';

// Mock fs
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

const mockReadFileSync = vi.mocked(readFileSync);

describe('GhostStoriesIndexer', () => {
  let indexer: any;
  let mockOptions: IndexerOptions;

  beforeEach(() => {
    indexer = createGhostStoriesIndexer({
      enabled: true,
      titlePrefix: 'V:',
    });

    mockOptions = {
      configDir: '/project/.storybook',
      workingDir: '/project',
    };

    vi.clearAllMocks();
  });

  describe('component detection', () => {
    it('should detect React functional components', async () => {
      const componentContent = `
import React from 'react';

interface ButtonProps {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({ label, disabled, onClick }) => {
  return <button disabled={disabled} onClick={onClick}>{label}</button>;
};

export default Button;
`;

      mockReadFileSync.mockReturnValue(componentContent);

      const result = await indexer.createIndex('/project/src/Button.tsx', mockOptions);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: 'V:Button',
        name: 'Default',
        ghostStory: true,
        componentName: 'Button',
        componentPath: '/project/src/Button.tsx',
      });
    });

    it('should skip story files', async () => {
      const storyContent = `
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Example/Button',
  component: Button,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: 'Button',
  },
};
`;

      mockReadFileSync.mockReturnValue(storyContent);

      const result = await indexer.createIndex('/project/src/Button.stories.tsx', mockOptions);

      expect(result).toHaveLength(0);
    });

    it('should generate correct argTypes for different prop types', async () => {
      const componentContent = `
interface TestProps {
  text: string;
  count: number;
  enabled: boolean;
  items: string[];
  onAction: () => void;
  theme: 'light' | 'dark';
}

export const TestComponent: React.FC<TestProps> = (props) => {
  return <div>{props.text}</div>;
};
`;

      mockReadFileSync.mockReturnValue(componentContent);

      const result = await indexer.createIndex('/project/src/TestComponent.tsx', mockOptions);

      expect(result).toHaveLength(1);
      const story = result[0];

      expect(story.argTypes).toHaveProperty('text');
      expect(story.argTypes.text.control.type).toBe('text');

      expect(story.argTypes).toHaveProperty('count');
      expect(story.argTypes.count.control.type).toBe('number');

      expect(story.argTypes).toHaveProperty('enabled');
      expect(story.argTypes.enabled.control.type).toBe('boolean');

      expect(story.argTypes).toHaveProperty('theme');
      expect(story.argTypes.theme.control.type).toBe('select');
      expect(story.argTypes.theme.control.options).toEqual(['light', 'dark']);
    });

    it('should generate appropriate default args', async () => {
      const componentContent = `
interface TestProps {
  text: string;
  count: number;
  enabled?: boolean;
}

export const TestComponent: React.FC<TestProps> = (props) => {
  return <div>{props.text}</div>;
};
`;

      mockReadFileSync.mockReturnValue(componentContent);

      const result = await indexer.createIndex('/project/src/TestComponent.tsx', mockOptions);

      expect(result).toHaveLength(1);
      const story = result[0];

      expect(story.args).toHaveProperty('text', 'Sample text');
      expect(story.args).toHaveProperty('count', 42);
      expect(story.args).toHaveProperty('enabled', false);
    });
  });

  describe('configuration', () => {
    it('should respect disabled configuration', async () => {
      const disabledIndexer = createGhostStoriesIndexer({
        enabled: false,
      });

      const componentContent = `
export const Button = () => <button>Click me</button>;
`;
      mockReadFileSync.mockReturnValue(componentContent);

      const result = await disabledIndexer.createIndex('/project/src/Button.tsx', mockOptions);

      expect(result).toHaveLength(0);
    });

    it('should use custom title prefix', async () => {
      const customIndexer = createGhostStoriesIndexer({
        enabled: true,
        titlePrefix: 'Ghost:',
      });

      const componentContent = `
export const Button = () => <button>Click me</button>;
`;
      mockReadFileSync.mockReturnValue(componentContent);

      const result = await customIndexer.createIndex('/project/src/Button.tsx', mockOptions);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Ghost:Button');
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = await indexer.createIndex('/project/src/Nonexistent.tsx', mockOptions);

      expect(result).toHaveLength(0);
    });

    it('should handle malformed component files', async () => {
      const malformedContent = `
invalid syntax {{
export const Button = 
`;

      mockReadFileSync.mockReturnValue(malformedContent);

      const result = await indexer.createIndex('/project/src/Button.tsx', mockOptions);

      // Even malformed files might still detect some components
      // The important thing is that it doesn't crash
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
