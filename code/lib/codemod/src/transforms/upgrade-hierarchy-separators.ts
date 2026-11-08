import {
  type ESTreeNode as Node,
  SourceEditor,
  isStringLiteral,
  objectProperty,
  walk,
} from 'storybook/internal/csf-tools';

import type { TransformFile } from '../lib/utils.ts';

function upgradeSeparators(editor: SourceEditor, node: Node | undefined) {
  if (isStringLiteral(node)) {
    // Only between the quotes, so the quotes stay as written.
    editor.edits.overwrite(
      node.start + 1,
      node.end - 1,
      editor.source(node).slice(1, -1).replace(/[|.]/g, '/')
    );
  }
}

export default function transform(info: TransformFile) {
  const editor = new SourceEditor(info.source, info.path);

  walk(editor.program, (node) => {
    // storiesOf(...)
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'storiesOf'
    ) {
      upgradeSeparators(editor, node.arguments[0]);
    }
    // export default { title: ... }
    if (node.type === 'ExportDefaultDeclaration' && node.declaration.type === 'ObjectExpression') {
      upgradeSeparators(editor, objectProperty(node.declaration, 'title')?.value);
    }
  });

  editor.commit();
  return editor.toString();
}
