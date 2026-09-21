import type { DocsClassification } from './classify-services.ts';

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
  classification: DocsClassification,
  id: string,
  mdx: MdxPayload | undefined
): Record<string, MdxDoc> | undefined {
  const attached = classification.attachedDocsByComponent.get(id) ?? [];
  if (attached.length === 0 || !mdx?.docs) {
    return undefined;
  }

  const docs: Record<string, MdxDoc> = {};
  for (const docsId of attached) {
    const doc = mdx.docs[docsId];
    if (doc) {
      docs[docsId] = doc;
    }
  }
  return docs;
}
