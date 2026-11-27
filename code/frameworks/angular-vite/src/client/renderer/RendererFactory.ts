import { AbstractRenderer } from './AbstractRenderer.ts';
import { CanvasRenderer } from './CanvasRenderer.ts';
import { DocsRenderer } from './DocsRenderer.ts';
import { TestBedRenderer } from './TestBedRenderer.ts';

type RenderType = 'canvas' | 'docs';
export class RendererFactory {
  private lastRenderType: RenderType | undefined;

  private rendererMap = new Map<string, AbstractRenderer>();

  public async getRendererInstance(
    targetDOMNode: HTMLElement,
    useTestBedRenderer = false
  ): Promise<AbstractRenderer> {
    const targetId = targetDOMNode.id;

    const renderType = getRenderType(targetDOMNode);
    // keep only instances of the same type
    if (this.lastRenderType && this.lastRenderType !== renderType) {
      await AbstractRenderer.resetApplications();
      clearRootHTMLElement(renderType);
      this.rendererMap.clear();
    }

    let renderer = this.rendererMap.get(targetId);
    if (!renderer) {
      renderer = this.buildRenderer(renderType, useTestBedRenderer);
      this.rendererMap.set(targetId, renderer);
    }

    this.lastRenderType = renderType;
    return renderer;
  }

  private buildRenderer(renderType: RenderType, useTestBedRenderer: boolean) {
    if (renderType === 'docs') {
      // A docs page renders several stories with potentially different application configs,
      // which cannot share the single TestBed environment injector.
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
      if (docsRoot) {
        docsRoot.innerHTML = '';
      }
      break;
    }

    case 'docs': {
      const canvasRoot = global.document.getElementById('storybook-root');
      if (canvasRoot) {
        canvasRoot.innerHTML = '';
      }
      break;
    }
    default:
      break;
  }
}
