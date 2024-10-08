import type { NodePath, PluginObj, types } from '@babel/core';

/**
 * Source:
 * https://github.com/vercel/next.js/blob/canary/packages/next/src/build/babel/plugins/amp-attributes.ts
 */
export default function AmpAttributePatcher(): PluginObj {
  return {
    visitor: {
      JSXOpeningElement(path: NodePath<types.JSXOpeningElement>) {
        const openingElement = path.node;

        const { name, attributes } = openingElement;
        if (!(name && name.type === 'JSXIdentifier')) {
          return;
        }

        if (!name.name.startsWith('amp-')) {
          return;
        }

        for (const attribute of attributes) {
          if (attribute.type !== 'JSXAttribute') {
            continue;
          }

          if (attribute.name.name === 'className') {
            attribute.name.name = 'class';
          }
        }
      },
    },
  };
}
