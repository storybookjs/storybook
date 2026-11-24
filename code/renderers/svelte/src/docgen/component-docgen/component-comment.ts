import { extractJSDocInfo } from 'storybook/internal/csf-tools';
import type { AST } from 'svelte/compiler';

export function extractComponentComment(root: AST.Root) {
  const comments = root.fragment.nodes.filter(
    (node): node is AST.Comment => node.type === 'Comment' && /@component\b/.test(node.data)
  );
  const comment = comments.find((node) => /^\s*@component\b/.test(node.data)) ?? comments[0];
  return comment
    ? extractJSDocInfo(
        comment.data
          .replace(/@component\b/, '')
          .replace(/\s+(@[a-zA-Z]+\b)/g, '\n$1')
          .trim()
      )
    : undefined;
}
