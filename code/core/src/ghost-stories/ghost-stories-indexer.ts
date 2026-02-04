import { readFileSync } from 'node:fs';
import { basename, dirname, relative } from 'node:path';

import { toId } from 'storybook/internal/csf';
import type { IndexInput, Indexer, IndexerOptions } from 'storybook/internal/types';

import {
  analyzeComponentProps,
  detectReactComponents,
  extractComponentName,
  generateFakeValue,
  isComponentFile,
} from './component-detector';
import type { GhostStoriesConfig, GhostStoryEntry, VirtualStoryIndexInput } from './types';

/** Default configuration for Ghost Stories */
const DEFAULT_CONFIG: GhostStoriesConfig = {
  enabled: true,
  titlePrefix: 'V:',
  includePatterns: ['**/*.{tsx,jsx,ts,js}'],
  excludePatterns: ['**/*.stories.*', '**/*.test.*', '**/*.spec.*'],
  propTypeMapping: {},
};

/** Ghost Stories Indexer Creates virtual stories for existing component files */
export class GhostStoriesIndexer implements Indexer {
  test: RegExp;
  private config: GhostStoriesConfig;

  constructor(config: Partial<GhostStoriesConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Match component files but exclude story files
    this.test = /\.(tsx|jsx|ts|js)$/;
  }

  async createIndex(fileName: string, options: IndexerOptions): Promise<IndexInput[]> {
    if (!this.config.enabled) {
      return [];
    }

    // Skip if this is a story file
    if (fileName.includes('.stories.')) {
      return [];
    }

    // Check if file is a component file
    if (!isComponentFile(fileName)) {
      return [];
    }

    try {
      const content = readFileSync(fileName, 'utf-8');
      const componentNames = detectReactComponents(fileName, content);

      if (componentNames.length === 0) {
        return [];
      }

      const entries: VirtualStoryIndexInput[] = [];

      for (const componentName of componentNames) {
        const props = analyzeComponentProps(content, componentName);
        const entry = this.createGhostStoryEntry(fileName, componentName, props, options);

        if (entry) {
          entries.push(entry);
        }
      }

      return entries;
    } catch (error) {
      // Only warn for actual errors, not for files that don't exist
      if ((error as Error).message !== 'File not found') {
        console.warn(`Error indexing file ${fileName}:`, error);
      }
      return [];
    }
  }

  private createGhostStoryEntry(
    fileName: string,
    componentName: string,
    props: any[],
    options: IndexerOptions
  ): VirtualStoryIndexInput | null {
    try {
      const baseName = basename(fileName);
      const dirName = dirname(fileName);
      const relativePath = relative(options.configDir || process.cwd(), fileName);

      // Create a virtual import path for the ghost story
      const virtualImportPath = `virtual:/ghost-stories/${relativePath}?component=${componentName}`;

      // Generate story ID
      const storyTitle = `${this.config.titlePrefix}${componentName}`;
      const storyName = 'Default';
      const storyId = toId(storyTitle, storyName);

      // Generate fake args based on component props
      const args: Record<string, any> = {};
      props.forEach((prop) => {
        // Include all props, but prioritize default values if available
        if (prop.defaultValue !== undefined) {
          args[prop.name] = prop.defaultValue;
        } else {
          args[prop.name] = generateFakeValue(prop.type);
        }
      });

      return {
        id: storyId,
        name: storyName,
        title: storyTitle,
        importPath: virtualImportPath,
        tags: ['ghost-story', 'virtual'],
        type: 'story',
        ghostStory: true,
        componentPath: fileName,
        componentName,
        props,
        parameters: {
          docs: {
            disable: true, // Disable docs for ghost stories initially
          },
        },
        argTypes: this.generateArgTypes(props),
        args,
      };
    } catch (error) {
      console.warn(`Error creating ghost story entry for ${componentName}:`, error);
      return null;
    }
  }

  private generateArgTypes(props: any[]): Record<string, any> {
    const argTypes: Record<string, any> = {};

    props.forEach((prop) => {
      argTypes[prop.name] = {
        name: prop.name,
        description: prop.description || `${prop.name} prop`,
        type: this.mapPropTypeToArgType(prop.type),
        defaultValue: prop.defaultValue,
        table: {
          type: { summary: prop.type.name },
          defaultValue: prop.defaultValue ? { summary: String(prop.defaultValue) } : undefined,
        },
        control: this.generateControlConfig(prop.type),
      };
    });

    return argTypes;
  }

  private mapPropTypeToArgType(propType: any): any {
    switch (propType.category) {
      case 'primitive':
        return { name: propType.name };
      case 'array':
        return { name: 'array' };
      case 'function':
        return { name: 'function' };
      case 'union':
        return { name: 'enum', value: propType.options };
      case 'object':
        return { name: 'object' };
      default:
        return { name: 'object' };
    }
  }

  private generateControlConfig(propType: any): any {
    switch (propType.category) {
      case 'primitive':
        switch (propType.name) {
          case 'boolean':
            return { type: 'boolean' };
          case 'number':
            return { type: 'number' };
          case 'string':
            return { type: 'text' };
          default:
            return { type: 'text' };
        }
      case 'union':
        if (propType.options && propType.options.length > 0) {
          return { type: 'select', options: propType.options };
        }
        return { type: 'text' };
      case 'array':
        return { type: 'object' };
      case 'object':
        return { type: 'object' };
      case 'function':
        return { type: 'object' };
      default:
        return { type: 'text' };
    }
  }
}

/** Factory function to create a Ghost Stories indexer */
export function createGhostStoriesIndexer(config: Partial<GhostStoriesConfig> = {}): Indexer {
  return new GhostStoriesIndexer(config);
}
