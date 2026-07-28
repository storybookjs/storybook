/**
 * Runtime access to the React renderer's docgen internals.
 *
 * The specifiers are built with `new URL` rather than written as static imports so the `scripts`
 * typecheck does not pull `code/renderers` source into its program. The structural interfaces below
 * are the minimum each harness touches; the real types live in
 * `code/renderers/react/src/componentManifest`.
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

/** The component reference the generated project's `Comp{i}` corresponds to. */
export function componentRef(i: number, componentPath: string): ComponentRefLike {
  return {
    componentName: `Comp${i}`,
    importName: `Comp${i}`,
    localImportName: `Comp${i}`,
    importId: `./Comp${i}`,
    isPackage: false,
    path: componentPath,
  };
}

export function buildStoryRefs(componentPaths: string[], storyPaths: string[]): StoryRefLike[] {
  return componentPaths.map((componentPath, i) => ({
    storyPath: storyPaths[i],
    component: componentRef(i, componentPath),
  }));
}

export interface ReactDocgenModule {
  getReactDocgen(
    path: string,
    component: ComponentRefLike
  ): { type: 'success' } | { type: 'error'; error: { name: string; message: string } };
}

export interface UtilsModule {
  invalidateCache(): void;
}

export interface ReactDocgenTypescriptModule {
  parseWithReactDocgenTypescript(filePath: string): Promise<Array<{ exportName?: string }>>;
  invalidateParser(): void;
}
