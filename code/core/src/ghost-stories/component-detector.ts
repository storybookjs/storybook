import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';

import type { ComponentProp } from './types';

/** Component file extensions that we want to analyze */
const COMPONENT_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte'];

/** Patterns to exclude from component detection */
const EXCLUDE_PATTERNS = [
  /\.stories\./,
  /\.test\./,
  /\.spec\./,
  /\.config\./,
  /\.setup\./,
  /index\./,
  /\.d\.ts$/,
];

/** Check if a file should be excluded from component detection */
export function shouldExcludeFile(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(filePath));
}

/** Check if a file is a potential component file */
export function isComponentFile(filePath: string): boolean {
  if (shouldExcludeFile(filePath)) {
    return false;
  }

  const ext = extname(filePath);
  return COMPONENT_EXTENSIONS.includes(ext);
}

/** Extract component name from file path */
export function extractComponentName(filePath: string): string {
  const fileName = basename(filePath);
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');

  // Convert kebab-case to PascalCase
  return nameWithoutExt
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** Detect if a file contains React component exports */
export function detectReactComponents(filePath: string, content: string): string[] {
  const components: string[] = [];

  try {
    // Simple regex-based detection for React components
    // This is a basic implementation - in a real scenario, you'd want to use AST parsing

    // Match default exports that look like components
    const defaultExportMatch = content.match(/export\s+default\s+function\s+(\w+)/);
    if (defaultExportMatch) {
      components.push(defaultExportMatch[1]);
    }

    // Match named exports that look like components (PascalCase)
    const namedExports = content.match(/export\s+(?:const|function)\s+([A-Z]\w*)/g);
    if (namedExports) {
      namedExports.forEach((match) => {
        const componentName = match.match(/export\s+(?:const|function)\s+([A-Z]\w*)/)?.[1];
        if (componentName) {
          components.push(componentName);
        }
      });
    }

    // Match arrow function exports
    const arrowFunctionExports = content.match(/export\s+const\s+([A-Z]\w*)\s*=\s*\(/g);
    if (arrowFunctionExports) {
      arrowFunctionExports.forEach((match) => {
        const componentName = match.match(/export\s+const\s+([A-Z]\w*)\s*=\s*\(/)?.[1];
        if (componentName) {
          components.push(componentName);
        }
      });
    }
  } catch (error) {
    console.warn(`Error analyzing file ${filePath}:`, error);
  }

  return [...new Set(components)]; // Remove duplicates
}

/**
 * Analyze component props from file content This is a simplified implementation - in practice,
 * you'd want to use TypeScript compiler API
 */
export function analyzeComponentProps(content: string, componentName: string): ComponentProp[] {
  const props: ComponentProp[] = [];

  try {
    // Look for TypeScript interface or type definitions
    // Try both ComponentProps and just Props patterns
    const interfacePatterns = [
      new RegExp(`interface\\s+${componentName}Props\\s*{([^}]+)}`, 's'),
      new RegExp(`interface\\s+Props\\s*{([^}]+)}`, 's'),
      new RegExp(`interface\\s+(\\w+Props?)\\s*{([^}]+)}`, 's'), // Generic props pattern
    ];

    const typePatterns = [
      new RegExp(`type\\s+${componentName}Props\\s*=\\s*{([^}]+)}`, 's'),
      new RegExp(`type\\s+Props\\s*=\\s*{([^}]+)}`, 's'),
      new RegExp(`type\\s+(\\w+Props?)\\s*=\\s*{([^}]+)}`, 's'), // Generic props pattern
    ];

    let propsDefinition = '';

    // Try interface patterns first
    for (const pattern of interfacePatterns) {
      const match = content.match(pattern);
      if (match) {
        propsDefinition = match[match.length - 1]; // Get the last capture group (the props content)
        break;
      }
    }

    // Try type patterns if no interface found
    if (!propsDefinition) {
      for (const pattern of typePatterns) {
        const match = content.match(pattern);
        if (match) {
          propsDefinition = match[match.length - 1]; // Get the last capture group (the props content)
          break;
        }
      }
    }

    if (propsDefinition) {
      // Parse individual properties
      const propLines = propsDefinition.split('\n').filter((line) => line.trim());

      propLines.forEach((line) => {
        // More flexible regex to handle different formatting
        const propMatch = line.match(/^\s*(\w+)(\?)?\s*:\s*(.+?)(?:;|,|$)/);
        if (propMatch) {
          const [, name, optional, type] = propMatch;
          props.push({
            name,
            type: parsePropType(type.trim()),
            required: !optional,
          });
        }
      });
    }
  } catch (error) {
    console.warn(`Error analyzing props for component ${componentName}:`, error);
  }

  return props;
}

/** Parse TypeScript type string into our PropType format */
function parsePropType(typeString: string): ComponentProp['type'] {
  // Remove optional markers and clean up
  const cleanType = typeString.replace(/\?/g, '').trim();

  // Handle union types
  if (cleanType.includes('|')) {
    const options = cleanType.split('|').map((opt) => opt.trim().replace(/['"]/g, ''));
    return {
      name: 'union',
      category: 'union',
      options,
    };
  }

  // Handle arrays
  if (cleanType.endsWith('[]') || cleanType.startsWith('Array<')) {
    return {
      name: 'array',
      category: 'array',
    };
  }

  // Handle functions
  if (cleanType.includes('=>') || (cleanType.startsWith('(') && cleanType.includes(')'))) {
    return {
      name: 'function',
      category: 'function',
    };
  }

  // Handle complex object types with curly braces
  if (cleanType.includes('{') && cleanType.includes('}')) {
    return {
      name: 'object',
      category: 'object',
    };
  }

  // Handle primitive types
  const primitiveTypes: Record<string, ComponentProp['type']> = {
    string: { name: 'string', category: 'primitive' },
    number: { name: 'number', category: 'primitive' },
    boolean: { name: 'boolean', category: 'primitive' },
    Date: { name: 'Date', category: 'primitive' },
    ReactNode: { name: 'ReactNode', category: 'primitive' },
    ReactElement: { name: 'ReactElement', category: 'primitive' },
  };

  if (primitiveTypes[cleanType]) {
    return primitiveTypes[cleanType];
  }

  // Default to object type for unknown types
  return {
    name: 'object',
    category: 'object',
  };
}

/** Generate fake default value for a prop type */
export function generateFakeValue(propType: ComponentProp['type']): any {
  switch (propType.category) {
    case 'primitive':
      switch (propType.name) {
        case 'string':
          return 'Sample text';
        case 'number':
          return 42;
        case 'boolean':
          return false;
        case 'Date':
          return new Date().toISOString();
        case 'ReactNode':
        case 'ReactElement':
          return 'Sample content';
        default:
          return 'Sample value';
      }

    case 'array':
      return [];

    case 'function':
      return () => {}; // Empty function

    case 'union':
      if (propType.options && propType.options.length > 0) {
        return propType.options[0];
      }
      return 'Sample value';

    case 'object':
    default:
      return {};
  }
}
