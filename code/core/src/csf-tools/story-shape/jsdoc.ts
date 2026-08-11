import type { types as t } from 'storybook/internal/babel';

import { extractDescription } from '../enrichCsf.ts';
import { extractJSDocInfo } from '../jsdoc.ts';

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
