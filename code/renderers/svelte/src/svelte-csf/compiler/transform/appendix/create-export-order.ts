import type { ExportNamedDeclaration } from 'estree';

import { getStoriesNames } from '../../../parser/analyse/Story/attributes/name.js';
import { storyNameToExportName } from '../../../utils/identifiers.js';

const EXPORT_ORDER_VARIABLE = '__namedExportsOrder';

interface Params {
  names: Awaited<ReturnType<typeof getStoriesNames>>;
  filename: string;
}

export function createExportOrderVariable(params: Params): ExportNamedDeclaration {
  const { names } = params;

  return {
    type: 'ExportNamedDeclaration',
    specifiers: [
      {
        type: 'ExportSpecifier',
        local: {
          type: 'Identifier',
          name: EXPORT_ORDER_VARIABLE,
        },
        exported: {
          type: 'Identifier',
          name: EXPORT_ORDER_VARIABLE,
        },
      },
    ],
    declaration: {
      type: 'VariableDeclaration',
      kind: 'const',
      declarations: [
        {
          type: 'VariableDeclarator',
          id: {
            type: 'Identifier',
            name: EXPORT_ORDER_VARIABLE,
          },
          init: {
            type: 'ArrayExpression',
            elements: names.map((name) => ({
              type: 'Literal',
              // TODO: There's probably some internal function in the Storybook to handle the story name?
              // Reference: https://github.com/storybookjs/addon-svelte-csf/pull/181#discussion_r1617937429
              value: storyNameToExportName(name),
            })),
          },
        },
      ],
    },
  };
}
