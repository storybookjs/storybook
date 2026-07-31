import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * The React harnesses measure the renderer's own extraction code, so they load it from source
 * rather than through the package's published surface.
 *
 * Joined as a path rather than concatenated into a URL: string concatenation only happens to work
 * while the directory ends in a separator and the caller's argument does not begin with one.
 */
const COMPONENT_MANIFEST = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'code',
  'renderers',
  'react',
  'src',
  'componentManifest'
);

export async function loadReactRendererModule<T>(relativePath: string): Promise<T> {
  const url = pathToFileURL(join(COMPONENT_MANIFEST, relativePath)).href;
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
