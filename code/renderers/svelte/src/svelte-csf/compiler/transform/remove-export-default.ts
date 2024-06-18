import { toJs } from 'estree-util-to-js';
import type MagicString from 'magic-string';

import type { CompiledASTNodes } from '#parser/extract/compiled/nodes';

interface Params {
  code: MagicString;
  nodes: CompiledASTNodes;
  filename?: string;
}

/**
 * We need to remove the default export from the code,
 * because Storybook internally expects export default `meta`.
 */
export function removeExportDefault(params: Params) {
  const { code, nodes } = params;
  const { exportDefault, storiesFunctionDeclaration } = nodes;

  if (exportDefault.declaration.type === 'FunctionDeclaration') {
    const { start, end } = exportDefault;

    // NOTE: It updates code by removing `export default` from the stories function declaration.
    code.update(
      start as number,
      end as number,
      toJs({
        type: 'Program',
        sourceType: 'module',
        body: [storiesFunctionDeclaration],
      }).value
    );
  }

  if (exportDefault.declaration.type === 'Identifier') {
    code.remove(exportDefault.start as number, exportDefault.end as number);
  }
}
