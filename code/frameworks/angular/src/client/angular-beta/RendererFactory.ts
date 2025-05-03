import { AbstractRenderer } from './AbstractRenderer';
import { CanvasRenderer } from './CanvasRenderer';
import { DocsRenderer } from './DocsRenderer';
import { TestBedRenderer } from './TestBedRenderer';
import { TestBedDocsRenderer } from './TestBedDocsRenderer';

type RenderType = 'canvas' | 'docs';
export class RendererFactory {
  private lastRenderType: RenderType;

  private rendererMap = new Map<string, AbstractRenderer>();

  public async getRendererInstance(
    targetDOMNode: HTMLElement,
    useTestBedRenderer: boolean
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
    if (useTestBedRenderer === true) {
      if (renderType === 'docs') {
        return new TestBedDocsRenderer();
      }
      return new TestBedRenderer();
    }
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
  let element;
  switch (renderType) {
    case 'canvas':
      element = global.document.getElementById('storybook-docs');
      if (element !== null) element.innerHTML = '';
      break;

    case 'docs':
      element = global.document.getElementById('storybook-root');
      if (element !== null) element.innerHTML = '';
      break;
    default:
      break;
  }
}
