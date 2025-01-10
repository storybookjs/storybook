import { Parameters, StoryFnAngularReturnType } from '../types';
import { AbstractRenderer } from './AbstractRenderer';

export class CanvasRenderer extends AbstractRenderer {
  public async render(options: {
    storyFnAngular: StoryFnAngularReturnType;
    forced: boolean;
    parameters: Parameters;
    component: any;
    targetDOMNode: HTMLElement;
  }) {
    await super.render(options);
  }

  async beforeFullRender(): Promise<void> {
    CanvasRenderer.resetApplications();
  }
}
