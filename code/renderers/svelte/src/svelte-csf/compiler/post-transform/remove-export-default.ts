import { print } from 'esrap';
import type MagicString from 'magic-string';

import type { CompiledASTNodes } from '../../parser/extract/compiled/nodes.ts';

interface Params {
  code: MagicString;
  nodes: CompiledASTNodes;
  filename?: string;
}

// Storybook expects the default export to be the meta, so the compiled component's default export goes.
export function removeExportDefault(params: Params) {
  const { code, nodes } = params;
  const { exportDefault, storiesFunctionDeclaration } = nodes;

  if (exportDefault.declaration.type === 'FunctionDeclaration') {
    const { start, end } = exportDefault;

    // NOTE: It updates code by removing `export default` from the stories function declaration.
    code.update(start as number, end as number, print(storiesFunctionDeclaration).code);
  }

  if (exportDefault.declaration.type === 'Identifier') {
    code.remove(exportDefault.start as number, exportDefault.end as number);
  }
}
