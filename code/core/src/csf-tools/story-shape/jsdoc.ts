import type { NodePath, types as t } from 'storybook/internal/babel';

import { extractDescription } from '../enrichCsf.ts';
import { extractJSDocInfo } from '../jsdoc.ts';

/**
 * JSDoc tags on the docblock of the statement a path belongs to.
 *
 * The docblock sits on the enclosing statement rather than the expression itself, so a `meta`
 * object literal has to look upwards to find the comment an author wrote above `const meta`.
 */
export function jsDocTagsForPath(path?: NodePath<t.Node>): Record<string, string[]> {
  const statement = path?.getStatementParent();
  const jsdocComment = statement ? extractDescription(statement.node) : '';

  return jsdocComment ? (extractJSDocInfo(jsdocComment).tags ?? {}) : {};
}

/** Story description and summary from its JSDoc; `@describe`/`@desc` tags override the body. */
export function extractStoryJSDocInfo(storyStatement?: t.Node): {
  description?: string;
  summary?: string;
} {
  const jsdocComment = extractDescription(storyStatement);
  const { tags = {}, description } = jsdocComment ? extractJSDocInfo(jsdocComment) : {};
  const finalDescription = (tags?.describe?.[0] || tags?.desc?.[0]) ?? description;

  return {
    description: finalDescription?.trim(),
    summary: tags.summary?.[0],
  };
}
