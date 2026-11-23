import type { DocsRenderFunction, Renderer } from 'storybook/internal/types';

// Loaded by the first `render`, so that a preview that imports the package entry starts without
// the docs blocks and React DOM. `unmount` is synchronous: until then it has nothing to remove.
let renderDocsModule: typeof import('./render-docs.tsx') | undefined;

export class DocsRenderer<TRenderer extends Renderer> {
  public render: DocsRenderFunction<TRenderer>;

  public unmount: (element: HTMLElement) => void;

  constructor() {
    this.render = async (context, docsParameter, element) => {
      renderDocsModule = await import('./render-docs.tsx');
      return renderDocsModule.renderDocs(context, docsParameter, element);
    };

    this.unmount = (element) => {
      renderDocsModule?.unmountDocs(element);
    };
  }
}
