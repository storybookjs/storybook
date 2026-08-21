import type { NodePath, types as t } from 'storybook/internal/babel';

import { extractDescription } from '../enrichCsf.ts';
import { extractComponentDescription, extractJSDocInfo } from '../jsdoc.ts';

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
  // A story docblock resolves exactly like a `meta` one; only the tag map is component-specific.
  const { description, summary } = extractComponentDescription(
    extractDescription(storyStatement) || undefined,
    undefined
  );

  return { description, summary };
}
