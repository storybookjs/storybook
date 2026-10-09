export type MdxDoc = {
  id: string;
  name: string;
  path?: string;
  title?: string;
  content?: string;
  summary?: string;
  error?: { name: string; message: string };
};

export type MdxPayload = {
  id: string;
  name: string;
  docs: Record<string, MdxDoc>;
};

/**
 * Picks a component's attached MDX docs out of its payload, shared by the Markdown and JSON docs
 * paths so the two cannot drift. `undefined` when the component has no attached docs, letting
 * callers omit the key entirely.
 */
export function selectAttachedDocs(
  attachedDocIds: string[],
  mdx: MdxPayload | undefined
): Record<string, MdxDoc> | undefined {
  if (attachedDocIds.length === 0 || !mdx?.docs) {
    return undefined;
  }

  const docs: Record<string, MdxDoc> = {};
  for (const docsId of attachedDocIds) {
    const doc = mdx.docs[docsId];
    if (doc) {
      docs[docsId] = doc;
    }
  }
  return docs;
}
