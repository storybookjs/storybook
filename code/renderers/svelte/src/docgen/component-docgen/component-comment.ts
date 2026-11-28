import { extractComponentDescription, extractJSDocInfo } from 'storybook/internal/csf-tools';
import { type AST, parse, preprocess } from 'svelte/compiler';

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

// The description, summary and tags a component's source gives it, in its `@component` comment.
// Preprocessors don't run here, so the styles are emptied: SCSS and the like fail to parse.
export async function readComponentDescription(source: string) {
  const { code } = await preprocess(source, { style: () => ({ code: '' }) });
  const comment = extractComponentComment(parse(code, { modern: true }));
  return extractComponentDescription(undefined, comment?.description.trim(), comment?.tags);
}
