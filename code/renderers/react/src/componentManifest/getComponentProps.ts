import { logger } from 'storybook/internal/node-logger';

import { type DocObj, type getReactDocgen, parseWithReactDocgen } from './reactDocgen';
import { cachedReadFileSync } from './utils';

/**
 * Extracts component name and React docgen data from a component file.
 *
 * This function reads a component file and uses react-docgen to parse its documentation and type
 * information. If a component name is provided, it will attempt to find that specific component's
 * documentation. If no name is provided, it will return the first component found or the default
 * export.
 *
 * @param filePath The absolute path to the component file.
 * @param componentName Optional name of the specific component to extract (if multiple components
 *   exist in the file).
 * @returns An object containing the component name and its react-docgen data, or null if no
 *   component is found.
 * @public
 */
export function getComponentDocgen(
  filePath: string,
  componentName?: string
): { componentName: string; reactDocgen: ReturnType<typeof getReactDocgen> } | null {
  try {
    const code = cachedReadFileSync(filePath, 'utf-8') as string;
    const docgens = parseWithReactDocgen(code, filePath);

    if (docgens.length === 0) {
      return null;
    }

    // If a specific component name is requested, find it
    if (componentName) {
      const matchingDocgen = docgens.find(
        (docgen) =>
          docgen.actualName === componentName ||
          docgen.displayName === componentName ||
          docgen.exportName === componentName
      );

      if (matchingDocgen) {
        return {
          componentName: matchingDocgen.actualName || matchingDocgen.displayName || componentName,
          reactDocgen: { type: 'success', data: matchingDocgen },
        };
      }

      // If a specific component name was requested but not found, return null
      return null;
    }

    // Otherwise, return the first component found (typically the default export)
    const firstDocgen = docgens[0];
    return {
      componentName: firstDocgen.actualName || firstDocgen.displayName || 'Unknown',
      reactDocgen: { type: 'success', data: firstDocgen },
    };
  } catch (error) {
    logger.debug(`Error parsing component file ${filePath}: ${error}`);
    return null;
  }
}

/**
 * Generate mocked component props values for a given component.
 *
 * This function reads a component file and uses react-docgen to parse its documentation and type
 * information. If a component name is provided, it will attempt to find that specific component's
 * documentation. If no name is provided, it will return the first component found or the default
 * export.
 *
 * @param filePath The absolute path to the component file.
 * @param componentName Optional name of the specific component to extract (if multiple components
 *   exist in the file).
 * @returns An object containing the component props, or null if no component is found.
 * @public
 */
export function getMockedProps(
  filePath: string,
  componentName?: string
): {
  required: Record<string, any>;
  optional: Record<string, any>;
} | null {
  const docgen = getComponentDocgen(filePath, componentName);
  if (!docgen) {
    return null;
  }
  if (docgen.reactDocgen.type !== 'success') {
    return null;
  }
  return generateMockProps(docgen.reactDocgen.data);
}

/**
 * Generates mock values for component props based on react-docgen type information.
 *
 * This function analyzes the props from react-docgen data and creates mock values for both required
 * and optional props. It intelligently generates appropriate mock values based on TypeScript types
 * (booleans, strings, numbers, dates, functions, etc.).
 *
 * @param docgenData The react-docgen data containing component props information.
 * @returns An object with required and optional props, each containing mock values.
 * @public
 */
export function generateMockProps(docgenData: DocObj): {
  required: Record<string, any>;
  optional: Record<string, any>;
} {
  const required: Record<string, any> = {};
  const optional: Record<string, any> = {};

  if (!docgenData.props) {
    return { required, optional };
  }

  for (const [propName, propInfo] of Object.entries(docgenData.props)) {
    const mockValue = generateMockValue({ ...propInfo.tsType, key: propName });
    if (propInfo.required) {
      required[propName] = mockValue;
    } else {
      optional[propName] = mockValue;
    }
  }

  return { required, optional };
}

/** Generates a mock value based on the TypeScript type information from react-docgen. */
function generateMockValue(tsType: any): any {
  const { name, elements, key } = tsType;
  const propName = (key || name || '').toLowerCase();
  console.log('stuff', JSON.stringify(tsType, null, 2));
  switch (name) {
    case 'boolean':
      return true;

    case 'string': {
      const name = propName.toLowerCase();

      // color
      if (/(background|color)$/i.test(name)) {
        return '#ff0000';
      }

      // date
      if (/(date|at)$/i.test(name)) {
        return '2025-01-01';
      }

      // image-like (strong match: exact, prefix, suffix; weak match only if no url keywords)
      const isImage =
        /^(image|img|photo|avatar|logo)/.test(name) ||
        /(image|img|photo|avatar|logo)$/i.test(name) ||
        /(image|img|photo|avatar|logo)/i.test(name);

      const isUrl = /(href|url|link|to)/i.test(name);

      if (isImage) {
        return 'https://placehold.co/600?text=Storybook&font=montserrat';
      }

      // url-like
      if (isUrl) {
        return 'https://foo.bar';
      }

      return propName || 'Hello world';
    }

    case 'number':
      return 42;

    case 'Date':
      return new Date('2025-01-01');

    case 'ReactElementType':
    case 'ReactNode':
      return '__react_node__';

    case 'signature':
      // Check if this is an object type (has properties) or a function type
      if (tsType.signature && tsType.signature.properties) {
        const obj: Record<string, any> = {};
        for (const prop of tsType.signature.properties) {
          obj[prop.key] = generateMockValue({ ...prop.value, key: prop.key });
        }
        return obj;
      }
      // Functions are turned into fn() from storybook/test
      return '__function__';

    case 'union':
      if (elements && elements.length > 0) {
        // Try to find a literal value first
        const literalElement = elements.find((el: any) => el.name === 'literal');
        if (literalElement) {
          const literalValue = literalElement.value;
          // Strip surrounding quotes from string literals
          if (
            typeof literalValue === 'string' &&
            literalValue.startsWith("'") &&
            literalValue.endsWith("'")
          ) {
            return literalValue.slice(1, -1);
          }
          return literalValue;
        }
        // Otherwise pick the first element and generate a mock for it
        return generateMockValue(elements[0]);
      }
      return '';

    case 'Array':
      // If element types are specified, generate a mock value for the element type
      if (elements && elements.length > 0) {
        const elementType = elements[0];
        // Check if this is a custom type that can't be properly mocked
        // Custom types typically start with uppercase and aren't built-in types
        const isCustomType =
          elementType.name &&
          ![
            'string',
            'number',
            'boolean',
            'Date',
            'ReactNode',
            'ReactReactNode',
            'signature',
            'union',
            'Array',
            'tuple',
            'Record',
            'literal',
            'null',
            'void',
            'any',
            'unknown',
          ].includes(elementType.name);

        if (isCustomType) {
          // For custom types we can't resolve, return empty array to avoid incorrect data
          return [];
        }
        // For known types, generate a proper mock value
        return [generateMockValue(elements[0])];
      }
      return [];

    case 'tuple':
      if (elements && elements.length > 0) {
        return elements.map((_: any) => generateMockValue({ name: 'string' }));
      }
      return [];

    case 'literal':
      const literalValue = tsType.value || 'mock literal';
      // Strip surrounding quotes from string literals
      if (
        typeof literalValue === 'string' &&
        literalValue.startsWith("'") &&
        literalValue.endsWith("'")
      ) {
        return literalValue.slice(1, -1);
      }
      return literalValue;

    case 'null':
      return null;

    case 'void':
      return undefined;

    case 'any':
      return name;

    case 'unknown':
      return name;

    default:
      // Handle complex types like ReactMouseEvent, HTMLButtonElement, etc.
      if (name?.startsWith('React') || name?.includes('Event') || name?.includes('Element')) {
        return '__function__'; // Event handlers
      }
      return name;
  }
}
