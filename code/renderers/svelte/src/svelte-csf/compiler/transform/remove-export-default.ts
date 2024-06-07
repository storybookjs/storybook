import { toJs } from 'estree-util-to-js';
import type MagicString from 'magic-string';

import type { CompiledASTNodes } from '../../parser/extract/compiled/nodes.js';

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
  const { code, nodes, filename } = params;
  const { exportDefault, storiesFunctionDeclaration } = nodes;

  if (exportDefault.declaration.type === 'FunctionDeclaration') {
    // @ts-expect-error FIXME: I couldn't find the right type (extension?) in the `estree`, but these exists at runtime
    const { start, end } = exportDefault;

    code.update(
      start,
      end,
      toJs({
        type: 'Program',
        sourceType: 'module',
        body: [storiesFunctionDeclaration],
      }).value
    );
  }

  if (exportDefault.declaration.type === 'Identifier') {
    // @ts-expect-error FIXME: I couldn't find the right type (extension?) in the `estree`, but these exists at runtime
    code.remove(exportDefault.start, exportDefault.end);
  }
}
