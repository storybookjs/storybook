import htmlTags from 'html-tags';

export function isHtmlTag(tagName: string): boolean {
  return htmlTags.includes(tagName.toLowerCase() as Parameters<typeof htmlTags.includes>[0]);
}
