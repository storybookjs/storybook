import { renderComponent } from '@ember/renderer';

import type { EmberRenderer, RenderContext } from './types';

export async function renderToCanvas(
  { storyFn, showMain }: RenderContext<EmberRenderer>,
  canvasElement: EmberRenderer['canvasElement']
) {
  showMain();

  renderComponent(storyFn(), { into: canvasElement });
}
