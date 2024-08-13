import { ArgsStoryFn, RenderContext } from 'storybook/internal/types';

import '@angular/compiler';

import { RendererFactory } from './angular-beta/RendererFactory';
import { AngularRenderer } from './types';

export const rendererFactory = new RendererFactory();

export const render: ArgsStoryFn<AngularRenderer> = (props) => ({ props });

export async function renderToCanvas(
  { storyFn, showMain, forceRemount, storyContext: { component } }: RenderContext<AngularRenderer>,
  element: HTMLElement
) {
  showMain();

  const renderer = await rendererFactory.getRendererInstance(element);

  await renderer.render({
    storyFnAngular: storyFn(),
    component,
    forced: !forceRemount,
    targetDOMNode: element,
  });
}
