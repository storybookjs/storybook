import { print } from 'esrap';
import ts from 'esrap/languages/ts';
import type MagicString from 'magic-string';

import type { CompiledASTNodes } from '../../parser/extract/compiled/nodes.ts';
import { span } from '../../parser/ast.ts';

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
    const { start, end } = span(exportDefault);

    // NOTE: It updates code by removing `export default` from the stories function declaration.
    code.update(start, end, print(storiesFunctionDeclaration, ts()).code);
  }

  if (exportDefault.declaration.type === 'Identifier') {
    const { start, end } = span(exportDefault);

    code.remove(start, end);
  }
}
