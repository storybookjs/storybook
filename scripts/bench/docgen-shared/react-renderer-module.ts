const COMPONENT_MANIFEST = '../../../code/renderers/react/src/componentManifest/';

export async function loadReactRendererModule<T>(relativePath: string): Promise<T> {
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
