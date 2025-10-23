import { readFileSync } from 'node:fs';
import { basename, dirname, relative } from 'node:path';

import { printCsf } from 'storybook/internal/csf-tools';
import type { CsfFile } from 'storybook/internal/csf-tools';

import {
  analyzeComponentProps,
  detectReactComponents,
  generateFakeValue,
} from './component-detector';
import type { ComponentProp } from './types';

/** Virtual module ID pattern for ghost stories */
export const GHOST_STORIES_VIRTUAL_PREFIX = 'virtual:/ghost-stories/';

/** Parse virtual module ID to extract component information */
export interface ParsedGhostStoryModule {
  originalPath: string;
  componentName: string;
  relativePath: string;
}

export function parseGhostStoryModuleId(moduleId: string): ParsedGhostStoryModule | null {
  if (!moduleId.startsWith(GHOST_STORIES_VIRTUAL_PREFIX)) {
    return null;
  }

  const pathPart = moduleId.substring(GHOST_STORIES_VIRTUAL_PREFIX.length);
  const [filePath, queryString] = pathPart.split('?');

  if (!queryString) {
    return null;
  }

  const params = new URLSearchParams(queryString);
  const componentName = params.get('component');

  if (!componentName) {
    return null;
  }

  return {
    originalPath: filePath,
    componentName,
    relativePath: pathPart,
  };
}

/** Generate virtual CSF content for a ghost story */
export function generateVirtualCsfContent(
  originalPath: string,
  componentName: string,
  workingDir: string = process.cwd()
): string {
  try {
    const fullPath = originalPath.startsWith('/') ? originalPath : `${workingDir}/${originalPath}`;

    const content = readFileSync(fullPath, 'utf-8');
    const props = analyzeComponentProps(content, componentName);

    // Generate fake args
    const args: Record<string, any> = {};
    props.forEach((prop) => {
      if (!prop.required || prop.defaultValue !== undefined) {
        args[prop.name] = generateFakeValue(prop.type);
      }
    });

    // Generate argTypes
    const argTypes: Record<string, any> = {};
    props.forEach((prop) => {
      argTypes[prop.name] = {
        name: prop.name,
        description: prop.description || `${prop.name} prop`,
        type: mapPropTypeToArgType(prop.type),
        defaultValue: prop.defaultValue,
        table: {
          type: { summary: prop.type.name },
          defaultValue: prop.defaultValue ? { summary: String(prop.defaultValue) } : undefined,
        },
        control: generateControlConfig(prop.type),
      };
    });

    // Create virtual CSF content
    const csfContent = generateCsfContent(originalPath, componentName, args, argTypes);

    return csfContent;
  } catch (error) {
    console.error(`Error generating virtual CSF for ${componentName}:`, error);

    // Return a minimal CSF in case of error
    return generateMinimalCsfContent(originalPath, componentName);
  }
}

/** Generate full CSF content */
function generateCsfContent(
  originalPath: string,
  componentName: string,
  args: Record<string, any>,
  argTypes: Record<string, any>
): string {
  const importPath = originalPath.replace(/\.(tsx|jsx|ts|js)$/, '');
  const title = `V:${componentName}`;
  const storyName = 'Default';

  return `import type { Meta, StoryObj } from '@storybook/react';
import { ${componentName} } from '${importPath}';

const meta: Meta<typeof ${componentName}> = {
  title: '${title}',
  component: ${componentName},
  parameters: {
    docs: {
      description: {
        component: 'This is a virtual story generated from component analysis. Use the controls to experiment with props and save your changes.',
      },
    },
  },
  argTypes: ${JSON.stringify(argTypes, null, 2)},
  args: ${JSON.stringify(args, null, 2)},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ${storyName}: Story = {
  args: ${JSON.stringify(args, null, 2)},
};
`;
}

/** Generate minimal CSF content in case of errors */
function generateMinimalCsfContent(originalPath: string, componentName: string): string {
  const importPath = originalPath.replace(/\.(tsx|jsx|ts|js)$/, '');
  const title = `V:${componentName}`;
  const storyName = 'Default';

  return `import type { Meta, StoryObj } from '@storybook/react';
import { ${componentName} } from '${importPath}';

const meta: Meta<typeof ${componentName}> = {
  title: '${title}',
  component: ${componentName},
  parameters: {
    docs: {
      description: {
        component: 'This is a virtual story generated from component analysis.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ${storyName}: Story = {};
`;
}

/** Map prop type to argType format */
function mapPropTypeToArgType(propType: ComponentProp['type']): any {
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

/** Generate control configuration */
function generateControlConfig(propType: ComponentProp['type']): any {
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
