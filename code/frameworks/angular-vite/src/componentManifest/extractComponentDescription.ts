import { extractJSDocInfo } from './jsdocTags.ts';

export function extractComponentDescription(
  metaJsDoc: string | undefined,
  compodocDescription: string | undefined
) {
  const rawComment = metaJsDoc || compodocDescription;
  const extracted = rawComment ? extractJSDocInfo(rawComment) : undefined;
  const tags = extracted?.tags ?? {};
  const description = extracted?.description;

  return {
    description: ((tags?.describe?.[0] || tags?.desc?.[0]) ?? description)?.trim(),
    summary: tags.summary?.[0],
    jsDocTags: tags,
  };
}
