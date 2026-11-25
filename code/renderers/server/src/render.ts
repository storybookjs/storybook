import type { RenderContext } from 'storybook/internal/types';

import { simulateDOMContentLoaded, simulatePageLoad } from 'storybook/preview-api';
import { dedent } from 'ts-dedent';

import type { ArgTypes, Args, StoryFn } from './public-types.ts';
import type { FetchStoryHtmlType, ServerRenderer } from './types.ts';

// Read once at load, so a fetch mock in user code can't intercept the story request.
const { fetch } = globalThis;

const defaultFetchStoryHtml: FetchStoryHtmlType = async (url, path, params, storyContext) => {
  const fetchUrl = new URL(`${url}/${path}`);
  fetchUrl.search = new URLSearchParams({ ...storyContext.globals, ...params }).toString();

  const response = await fetch(fetchUrl);
  return response.text();
};

// Strings keep dates and objects readable by servers in any language. A date control holds a
// timestamp, which only its control type tells apart from a number.
const serializeArg = (value: unknown, isDateControl: boolean) => {
  if (value instanceof Date || isDateControl) {
    return new Date(value as Date | number | string).toISOString();
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
};

const isDateControl = (argType: ArgTypes[string] | undefined) => {
  const control = argType?.control;
  return (
    !!control &&
    typeof control === 'object' &&
    'type' in control &&
    control.type?.toLowerCase() === 'date'
  );
};

const buildStoryArgs = (args: Args, argTypes: ArgTypes) =>
  Object.fromEntries(
    Object.entries(args).map(([key, value]) => [
      key,
      serializeArg(value, isDateControl(argTypes[key])),
    ])
  );

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
  } else if (element instanceof globalThis.Node) {
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
