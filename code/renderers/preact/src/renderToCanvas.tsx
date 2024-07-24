import * as preact from 'preact';

import type { RenderContext } from 'storybook/internal/types';

import type { StoryFnPreactReturnType, PreactRenderer, StoryContext } from './types';

const { h } = preact;

let renderedStory: Element;

function renderElement(story: StoryFnPreactReturnType | null, canvasElement: Element): void {
  // @ts-expect-error (Converted from ts-ignore)
  if (preact.Fragment) {
    // Preact 10 only:
    preact.render(story, canvasElement);
  } else {
    renderedStory = preact.render(story, canvasElement, renderedStory) as unknown as Element;
  }
}

const unmountElement = (canvasElement: Element) => renderElement(null, canvasElement);

class ErrorBoundary extends preact.Component<{
  showException: (err: Error) => void;
  showMain: () => void;
  children?: preact.ComponentChildren;
}> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidMount() {
    const { hasError } = this.state;
    const { showMain } = this.props;
    if (!hasError) {
      showMain();
    }
  }

  componentDidCatch(err: Error) {
    const { showException } = this.props;
    // message partially duplicates stack, strip it
    showException(err);
  }

  render() {
    const { hasError } = this.state;
    const { children } = this.props;

    return hasError ? null : children;
  }
}

export function renderToCanvas(
  {
    storyContext,
    unboundStoryFn,
    showMain,
    showException,
    forceRemount,
  }: RenderContext<PreactRenderer>,
  canvasElement: PreactRenderer['canvasElement']
) {
  const Story = unboundStoryFn as preact.FunctionComponent<StoryContext<PreactRenderer>>;

  const content = h(ErrorBoundary, { showMain, showException }, h(Story, storyContext));

  if (forceRemount) {
    unmountElement(canvasElement);
  }

  renderElement(content, canvasElement);

  return () => unmountElement(canvasElement);
}
