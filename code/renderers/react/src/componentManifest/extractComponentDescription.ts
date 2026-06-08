import { extractJSDocInfo } from './jsdocTags.ts';

export function extractComponentDescription(
  metaJsDoc: string | undefined,
  docgenDescription: string | undefined,
  docgenJsDocTags?: Record<string, string[]>
) {
  const jsdocComment = metaJsDoc || docgenDescription;
  const extracted = jsdocComment ? extractJSDocInfo(jsdocComment) : undefined;
  const tags = docgenJsDocTags ?? extracted?.tags ?? {};
  const description = extracted?.description;

  return {
    description: ((tags?.describe?.[0] || tags?.desc?.[0]) ?? description)?.trim(),
    summary: tags.summary?.[0],
    jsDocTags: tags,
  };
}
