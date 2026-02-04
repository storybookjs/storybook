import type { IndexInput, IndexerOptions } from 'storybook/internal/types';

export interface GhostStoryEntry {
  id: string;
  title: string;
  name: string;
  importPath: string;
  componentPath: string;
  componentName: string;
  props: ComponentProp[];
}

export interface ComponentProp {
  name: string;
  type: PropType;
  defaultValue?: any;
  description?: string;
  required?: boolean;
}

export interface PropType {
  name: string;
  category: 'primitive' | 'object' | 'array' | 'function' | 'union';
  value?: any;
  options?: string[]; // for union types with specific values
}

export interface GhostStoriesConfig {
  enabled: boolean;
  titlePrefix: string;
  includePatterns: string[];
  excludePatterns: string[];
  propTypeMapping: Record<string, PropType>;
}

export interface GhostStoriesIndexerOptions extends IndexerOptions {
  ghostStoriesConfig: GhostStoriesConfig;
}

export interface VirtualStoryIndexInput extends IndexInput {
  ghostStory: true;
  componentPath: string;
  componentName: string;
  props: ComponentProp[];
}
