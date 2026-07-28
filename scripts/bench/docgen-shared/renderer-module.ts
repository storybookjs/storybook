/**
 * Runtime access to the React renderer's docgen internals.
 *
 * The specifiers are built with `new URL` rather than written as static imports so the `scripts`
 * typecheck does not pull `code/renderers` source into its program. The ref interfaces below are the
 * minimum the harnesses pass across that boundary; the real types live in
 * `code/renderers/react/src/componentManifest`. Each harness declares the shape of the module it
 * loads next to its own call.
 */

const COMPONENT_MANIFEST = '../../../code/renderers/react/src/componentManifest/';

export async function loadRendererModule<T>(relativePath: string): Promise<T> {
  const url = new URL(`${COMPONENT_MANIFEST}${relativePath}`, import.meta.url).href;
  return (await import(url)) as T;
}

export interface ComponentRefLike {
  componentName: string;
  importName: string;
  localImportName: string;
  importId: string;
  isPackage: boolean;
  path: string;
}

export interface StoryRefLike {
  storyPath: string;
  component: ComponentRefLike;
}
