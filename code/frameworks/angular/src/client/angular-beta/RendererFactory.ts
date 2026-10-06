import { AbstractRenderer } from './AbstractRenderer.ts';
import { CanvasRenderer } from './CanvasRenderer.ts';
import { DocsRenderer } from './DocsRenderer.ts';

type RenderType = 'canvas' | 'docs';
export class RendererFactory {
  private lastRenderType: RenderType | undefined;

  private rendererMap = new Map<string, AbstractRenderer>();

  public async getRendererInstance(targetDOMNode: HTMLElement): Promise<AbstractRenderer> {
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
      renderer = this.buildRenderer(renderType);
      this.rendererMap.set(targetId, renderer);
    }

    this.lastRenderType = renderType;
    return renderer;
  }

  private buildRenderer(renderType: RenderType) {
    if (renderType === 'docs') {
      return new DocsRenderer();
    }
    return new CanvasRenderer();
  }
}

export const getRenderType = (targetDOMNode: HTMLElement): RenderType => {
  return targetDOMNode.id === 'storybook-root' ? 'canvas' : 'docs';
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
