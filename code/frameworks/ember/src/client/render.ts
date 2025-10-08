import { renderComponent } from '@ember/renderer';

import type { EmberRenderer, RenderContext } from './types';

export function renderToCanvas(
  { storyFn, showMain }: RenderContext<EmberRenderer>,
  canvasElement: EmberRenderer['canvasElement']
) {
  showMain();

  console.log('Ember renderer', storyFn());

  renderComponent(storyFn(), { into: canvasElement });
}
