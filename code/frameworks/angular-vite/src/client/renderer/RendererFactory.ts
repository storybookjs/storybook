import { AbstractRenderer } from './AbstractRenderer.ts';
import { CanvasRenderer } from './CanvasRenderer.ts';
import { DocsRenderer } from './DocsRenderer.ts';
import { TestBedRenderer } from './TestBedRenderer.ts';

type RenderType = 'canvas' | 'docs';
export class RendererFactory {
  private lastRenderType: RenderType;

  private rendererMap = new Map<string, AbstractRenderer>();

  public async getRendererInstance(
    targetDOMNode: HTMLElement,
    useTestBedRenderer = false
  ): Promise<AbstractRenderer | null> {
    const targetId = targetDOMNode.id;
    // do nothing if the target node is null
    // fix a problem when the docs asks 2 times the same component at the same time
    // the 1st targetDOMNode of the 1st requested rendering becomes null 🤷‍♂️
    if (targetDOMNode === null) {
      return null;
    }

    const renderType = getRenderType(targetDOMNode);
    // keep only instances of the same type
    if (this.lastRenderType && this.lastRenderType !== renderType) {
      await AbstractRenderer.resetApplications();
      clearRootHTMLElement(renderType);
      this.rendererMap.clear();
    }

    if (!this.rendererMap.has(targetId)) {
      this.rendererMap.set(targetId, this.buildRenderer(renderType, useTestBedRenderer));
    }

    this.lastRenderType = renderType;
    return this.rendererMap.get(targetId);
  }

  private buildRenderer(renderType: RenderType, useTestBedRenderer: boolean) {
    if (renderType === 'docs') {
      // The TestBed strategy is canvas-only: a docs page renders multiple stories with
      // potentially different application configs, which cannot share the single TestBed
      // environment injector.
      return new DocsRenderer();
    }
    return useTestBedRenderer ? new TestBedRenderer() : new CanvasRenderer();
  }
}

// Pick the renderer by inspecting the target node's surroundings. The
// classic UI puts every canvas mount on `#storybook-root` and every docs
// mount inside `#storybook-docs`. Under `@storybook/addon-vitest` the test
// runner creates a synthetic DIV that has neither id, but we want it to use
// the canvas path (a single component bootstrap, no `getNextStoryUID`
// suffixing), so docs mode is only chosen when the node is provably inside
// `#storybook-docs`.
export const getRenderType = (targetDOMNode: HTMLElement): RenderType => {
  if (targetDOMNode.id === 'storybook-docs') {
    return 'docs';
  }
  const doc = (targetDOMNode.ownerDocument ?? global.document) as Document | undefined;
  const docsRoot = doc?.getElementById('storybook-docs') ?? null;
  if (docsRoot && docsRoot !== targetDOMNode && docsRoot.contains(targetDOMNode)) {
    return 'docs';
  }
  return 'canvas';
};

export function clearRootHTMLElement(renderType: RenderType) {
  switch (renderType) {
    case 'canvas': {
      const docsRoot = global.document.getElementById('storybook-docs');
      if (docsRoot !== null) {
        docsRoot.innerHTML = '';
      }
      break;
    }

    case 'docs': {
      const storyRoot = global.document.getElementById('storybook-root');
      if (storyRoot !== null) {
        storyRoot.innerHTML = '';
      }
      break;
    }
    default:
      break;
  }
}
