import {
  type ESTreeNode as Node,
  SourceEditor,
  isStringLiteral,
  objectProperty,
  unwrapExpression,
  walk,
} from 'storybook/internal/csf-tools';

import type { TransformFile } from '../lib/utils.ts';

function upgradeSeparators(editor: SourceEditor, node: Node | undefined) {
  if (!isStringLiteral(node)) {
    return;
  }
  // Only between the quotes, so the quotes stay as written.
  const text = editor.source(node).slice(1, -1);
  const upgraded = text.replace(/[|.]/g, '/');
  if (upgraded !== text) {
    editor.edits.overwrite(node.start + 1, node.end - 1, upgraded);
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
    if (node.type === 'ExportDefaultDeclaration') {
      const meta = unwrapExpression(node.declaration);
      if (meta.type === 'ObjectExpression') {
        upgradeSeparators(editor, objectProperty(meta, 'title')?.value);
      }
    }
  });

  editor.commit();
  return editor.toString();
}
