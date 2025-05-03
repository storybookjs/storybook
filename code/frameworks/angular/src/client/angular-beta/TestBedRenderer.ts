import { AbstractRenderer } from './AbstractRenderer';
import { StoryFnAngularReturnType, Parameters } from '../types';

export class TestBedRenderer extends AbstractRenderer {
  public async render(options: {
    storyFnAngular: StoryFnAngularReturnType;
    forced: boolean;
    parameters: Parameters;
    component: any;
    targetDOMNode: HTMLElement;
  }) {
    await this.renderWithTestBed({ ...options });
  }

  async beforeFullRender(): Promise<void> {
    TestBedRenderer.resetApplications();
  }
}
