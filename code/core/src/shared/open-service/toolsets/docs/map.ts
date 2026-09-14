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
 * A component's attached MDX docs out of its payload, shared by the Markdown and JSON docs paths so
 * the two cannot drift. `undefined` when the component has no attached docs, letting callers omit
 * the key entirely.
 */
export function selectAttachedDocs(
  mdx: MdxPayload | undefined
): Record<string, MdxDoc> | undefined {
  return mdx?.docs && Object.keys(mdx.docs).length > 0 ? mdx.docs : undefined;
}
