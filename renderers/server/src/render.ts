import { simulateDOMContentLoaded, simulatePageLoad } from 'storybook/internal/preview-api';
import type { RenderContext } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { dedent } from 'ts-dedent';

import type { ArgTypes, Args, StoryFn } from './public-types';
import type { FetchStoryHtmlType, ServerRenderer } from './types';

const { fetch, Node } = global;

const defaultFetchStoryHtml: FetchStoryHtmlType = async (url, path, params, storyContext) => {
  const fetchUrl = new URL(`${url}/${path}`);
  fetchUrl.search = new URLSearchParams({ ...storyContext.globals, ...params }).toString();

  const response = await fetch(fetchUrl);
  return response.text();
};

const buildStoryArgs = (args: Args, argTypes: ArgTypes) => {
  const storyArgs = { ...args };

  Object.keys(argTypes).forEach((key: string) => {
    const argType = argTypes[key];
    const { control } = argType;
    const controlType =
      control && typeof control === 'object' && 'type' in control && control.type?.toLowerCase();
    const argValue = storyArgs[key];
    switch (controlType) {
      case 'date':
        // For cross framework & language support we pick a consistent representation of Dates as strings
        storyArgs[key] = new Date(argValue).toISOString();
        break;
      case 'object':
        // send objects as JSON strings
        storyArgs[key] = JSON.stringify(argValue);
        break;
      default:
    }
  });

  return storyArgs;
};

export const render: StoryFn<ServerRenderer> = (args: Args) => {};

export async function renderToCanvas(
  {
    id,
    title,
    name,
    showMain,
    showError,
    forceRemount,
    storyFn,
    storyContext,
    storyContext: { parameters, args, argTypes },
  }: RenderContext<ServerRenderer>,
  canvasElement: ServerRenderer['canvasElement']
) {
  // Some addons wrap the storyFn so we need to call it even though Server doesn't need the answer
  storyFn();
  const storyArgs = buildStoryArgs(args, argTypes);

  const {
    server: { url, id: storyId, fetchStoryHtml = defaultFetchStoryHtml, params },
  } = parameters;

  const fetchId = storyId || id;
  const storyParams = { ...params, ...storyArgs };
  const element = await fetchStoryHtml(url, fetchId, storyParams, storyContext);

  showMain();
  if (typeof element === 'string') {
    canvasElement.innerHTML = element;
    simulatePageLoad(canvasElement);
  } else if (element instanceof Node) {
    // Don't re-mount the element if it didn't change and neither did the story
    if (canvasElement.firstChild === element && forceRemount === false) {
      return;
    }

    canvasElement.innerHTML = '';
    canvasElement.appendChild(element);
    simulateDOMContentLoaded();
  } else {
    showError({
      title: `Expecting an HTML snippet or DOM node from the story: "${name}" of "${title}".`,
      description: dedent`
        Did you forget to return the HTML snippet from the story?
        Use "() => <your snippet or node>" or when defining the story.
      `,
    });
  }
}
