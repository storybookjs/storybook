import type { Node } from '../estree/ast.ts';
import type { SourceEditor } from '../estree/editor.ts';
import { extractDescription } from '../enrichCsf.ts';
import { extractComponentDescription, extractJSDocInfo } from '../jsdoc.ts';

/**
 * JSDoc tags on the docblock of the statement a node belongs to.
 *
 * The docblock sits on the enclosing statement rather than the expression itself, so a `meta`
 * object literal has to look upwards to find the comment an author wrote above `const meta`.
 */
export function jsDocTagsForNode(
  node: Node | undefined,
  editor: SourceEditor
): Record<string, string[]> {
  const statement = node ? editor.statementOf(node) : undefined;
  const jsdocComment = statement ? extractDescription(statement, editor) : '';

  return jsdocComment ? (extractJSDocInfo(jsdocComment).tags ?? {}) : {};
}

/** Story description and summary from its JSDoc; `@describe`/`@desc` tags override the body. */
export function extractStoryJSDocInfo(
  storyStatement: Node | undefined,
  editor: SourceEditor
): {
  description?: string;
  summary?: string;
} {
  // A story docblock resolves exactly like a `meta` one; only the tag map is component-specific.
  const { description, summary } = extractComponentDescription(
    extractDescription(storyStatement, editor) || undefined,
    undefined
  );

  return { description, summary };
}
