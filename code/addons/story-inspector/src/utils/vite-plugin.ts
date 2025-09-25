import { babelParse, generate, traverse } from 'storybook/internal/babel';
import type { Options } from 'storybook/internal/types';

import { COMPONENT_PATH_ATTRIBUTE } from '../constants';

/**
 * This Vite plugin injects component file path metadata into JSX/TSX elements so they can be
 * identified by the story inspector
 */
export function componentPathInjectorPlugin(options?: Options): any {
  // Simple filter function instead of using vite's createFilter
  const filter = (id: string) => {
    // Include React/Vue/Svelte component files
    const includeExtensions = ['.jsx', '.tsx', '.js', '.ts', '.vue', '.svelte'];
    const hasIncludedExt = includeExtensions.some((ext) => id.endsWith(ext));

    // Exclude certain patterns
    const excludePatterns = ['node_modules', '.stories.', '.spec.', '.test.', 'dist', 'build'];
    const isExcluded = excludePatterns.some((pattern) => id.includes(pattern));

    return hasIncludedExt && !isExcluded;
  };

  return {
    name: 'storybook:story-inspector-component-path-injector',
    enforce: 'pre', // Run before other transforms

    async transform(code: string, id: string) {
      if (!filter(id)) {
        return undefined;
      }

      // Skip if this doesn't look like a component file
      if (!isComponentFile(code)) {
        return undefined;
      }

      // Find JSX elements and add the component path attribute using AST parsing
      const transformedCode = injectComponentPath(code, id);

      if (transformedCode === code) {
        return undefined; // No changes made
      }

      return {
        code: transformedCode,
        // For AST-based transformations, we don't generate source maps
        // as Babel handles this internally and it's complex to maintain
        map: null as any,
      };
    },
  };
}

/** Check if the file likely contains React components */
function isComponentFile(code: string): boolean {
  // Look for JSX elements or React imports
  return (
    code.includes('</') &&
    (code.includes('jsx') ||
      code.includes('React') ||
      /export\s+(default\s+)?function\s+[A-Z]/.test(code) ||
      /export\s+(default\s+)?const\s+[A-Z]/.test(code) ||
      /export\s+{\s*[A-Z]/.test(code))
  );
}

/** Inject component path attribute into JSX elements using AST parsing */
function injectComponentPath(code: string, filePath: string): string {
  // Make file path relative with ./ prefix - similar to how story index calculates paths
  const root = process.cwd();
  let normalizedPath = filePath.replace(root, '');
  normalizedPath = normalizedPath.startsWith('./') ? normalizedPath : `.${normalizedPath}`;
  try {
    // Parse the code into an AST
    const ast = babelParse(code);

    let hasChanges = false;

    // Traverse the AST to find JSX opening elements
    traverse(ast, {
      JSXOpeningElement(path) {
        const { node } = path;

        // Check if this is a React component (starts with uppercase)
        if (node.name.type === 'JSXIdentifier') {
          const componentName = node.name.name;

          // Skip HTML elements (lowercase first letter)
          if (componentName[0].toLowerCase() === componentName[0]) {
            return;
          }

          // Check if we already have this attribute
          const hasAttribute = node.attributes.some((attr) => {
            return (
              attr.type === 'JSXAttribute' &&
              attr.name.type === 'JSXIdentifier' &&
              attr.name.name === COMPONENT_PATH_ATTRIBUTE
            );
          });

          if (!hasAttribute) {
            // Add the component path attribute
            node.attributes.push({
              type: 'JSXAttribute',
              name: {
                type: 'JSXIdentifier',
                name: COMPONENT_PATH_ATTRIBUTE,
              },
              value: {
                type: 'StringLiteral',
                value: normalizedPath,
              },
            } as any);
            hasChanges = true;
          }
        } else if (node.name.type === 'JSXMemberExpression') {
          // Handle member expressions like Namespace.Component
          const getComponentName = (expr: any): string => {
            if (expr.type === 'JSXIdentifier') {
              return expr.name;
            }
            if (expr.type === 'JSXMemberExpression') {
              return getComponentName(expr.object) + '.' + getComponentName(expr.property);
            }
            return '';
          };

          const componentName = getComponentName(node.name);

          // Skip if first part is lowercase (like html.div)
          const firstPart = componentName.split('.')[0];
          if (firstPart[0]?.toLowerCase() === firstPart[0]) {
            return;
          }

          // Check if we already have this attribute
          const hasAttribute = node.attributes.some((attr) => {
            return (
              attr.type === 'JSXAttribute' &&
              attr.name.type === 'JSXIdentifier' &&
              attr.name.name === COMPONENT_PATH_ATTRIBUTE
            );
          });

          if (!hasAttribute) {
            // Add the component path attribute
            node.attributes.push({
              type: 'JSXAttribute',
              name: {
                type: 'JSXIdentifier',
                name: COMPONENT_PATH_ATTRIBUTE,
              },
              value: {
                type: 'StringLiteral',
                value: normalizedPath,
              },
            } as any);
            hasChanges = true;
          }
        }
      },
    });

    if (hasChanges) {
      // Generate the modified code
      const result = generate(ast, {
        retainLines: true,
        compact: false,
      });
      return result.code;
    }

    return code;
  } catch (error) {
    // If AST parsing fails, return original code
    console.warn('Story Inspector: Failed to parse code with AST, skipping transformation:', error);
    return code;
  }
}
