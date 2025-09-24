import MagicString from 'magic-string';

import { COMPONENT_PATH_ATTRIBUTE } from '../constants';

/**
 * This Vite plugin injects component file path metadata into JSX/TSX elements so they can be
 * identified by the story inspector
 */
export function componentPathInjectorPlugin(options?: any): any {
  // Simple filter function instead of using vite's createFilter
  const filter = (id: string) => {
    // Include React/Vue/Svelte component files
    const includeExtensions = ['.jsx', '.tsx', '.js', '.ts', '.vue', '.svelte'];
    const hasIncludedExt = includeExtensions.some((ext) => id.endsWith(ext));

    // Exclude certain patterns
    const excludePatterns = ['node_modules', '.stories.', '.spec.', '.test.'];
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

      const s = new MagicString(code);

      // Find JSX elements and add the component path attribute
      const transformedCode = injectComponentPath(s, code, id);

      if (transformedCode === code) {
        return undefined; // No changes made
      }

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true, source: id }),
      };
    },
  };
}

/** Check if the file likely contains React components */
function isComponentFile(code: string): boolean {
  // Look for JSX elements or React imports
  return (
    code.includes('jsx') ||
    code.includes('React') ||
    code.includes('</') ||
    /export\s+(default\s+)?function\s+[A-Z]/.test(code) ||
    /export\s+(default\s+)?const\s+[A-Z]/.test(code) ||
    /export\s+{\s*[A-Z]/.test(code)
  );
}

/** Inject component path attribute into JSX elements */
function injectComponentPath(s: MagicString, code: string, filePath: string): string {
  // This is a simplified approach - in a real implementation we'd use a proper AST parser
  // For now, we'll use regex to find JSX opening tags and add our attribute

  // Normalize file path
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Find JSX opening tags that don't already have our attribute
  const jsxElementRegex = /<([A-Z][a-zA-Z0-9]*(?:\.[A-Z][a-zA-Z0-9]*)*)\s*([^>]*?)(\s*\/?>)/g;

  let match;
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  while ((match = jsxElementRegex.exec(code)) !== null) {
    const [fullMatch, componentName, attributes, closing] = match;
    const { index } = match;

    // Skip if already has our attribute
    if (attributes.includes(COMPONENT_PATH_ATTRIBUTE)) {
      continue;
    }

    // Skip HTML elements (lowercase first letter)
    if (componentName[0].toLowerCase() === componentName[0]) {
      continue;
    }

    // Build replacement
    const trimmedAttributes = attributes.trim();
    const attributesToAdd = trimmedAttributes
      ? ` ${trimmedAttributes} ${COMPONENT_PATH_ATTRIBUTE}="${normalizedPath}"`
      : ` ${COMPONENT_PATH_ATTRIBUTE}="${normalizedPath}"`;

    const replacement = `<${componentName}${attributesToAdd}${closing}`;
    replacements.push({ start: index, end: index + fullMatch.length, replacement });
  }

  // Apply replacements in reverse order to maintain indices
  replacements.reverse().forEach(({ start, end, replacement }) => {
    s.overwrite(start, end, replacement);
  });

  return s.toString();
}
