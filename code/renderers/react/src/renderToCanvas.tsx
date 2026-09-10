import type { FC } from 'react';
import React, { Fragment, Component as ReactComponent, StrictMode } from 'react';

import type { RenderContext } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { getAct } from './act-compat.ts';
import type { ReactRenderer, StoryContext } from './types.ts';

const { FRAMEWORK_OPTIONS } = global;

class ErrorBoundary extends ReactComponent<{
  showException: (err: Error) => void;
  showMain: () => void;
  children?: React.ReactNode;
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

const Wrapper = FRAMEWORK_OPTIONS?.strictMode ? StrictMode : Fragment;

const actQueue: (() => Promise<void>)[] = [];
let isActing = false;

// Tracks how many times each canvas element was force-remounted, so the story subtree below
// can be given a fresh key per remount (see the forceRemount comment in renderToCanvas).
const remountCounts = new WeakMap<ReactRenderer['canvasElement'], number>();

const processActQueue = async () => {
  if (isActing || actQueue.length === 0) {
    return;
  }

  isActing = true;
  const actTask = actQueue.shift();
  if (actTask) {
    await actTask();
  }
  isActing = false;
  processActQueue();
};

export async function renderToCanvas(
  {
    storyContext,
    unboundStoryFn,
    showMain,
    showException,
    forceRemount,
  }: RenderContext<ReactRenderer>,
  canvasElement: ReactRenderer['canvasElement']
) {
  const { renderElement, unmountElement } = await import('@storybook/react-dom-shim');
  const Story = unboundStoryFn as FC<StoryContext<ReactRenderer>>;

  const isPortableStory = storyContext.parameters.__isPortableStory;

  // On forceRemount we need React to recreate the component instances for the story run
  // (not the case when we change args or globals however), see:
  // https://github.com/storybookjs/react-storybook/issues/81
  // Instead of unmounting the whole root — which empties the document between two renders and
  // makes the browser clamp the scroll position to 0 (#22057) — we give the story subtree a
  // fresh key per remount, so React replaces it within a single commit.
  if (forceRemount) {
    if (isPortableStory) {
      // Portable stories render without the keyed ErrorBoundary below, so a full unmount is
      // still the way to guarantee fresh component instances.
      unmountElement(canvasElement);
    } else {
      remountCounts.set(canvasElement, (remountCounts.get(canvasElement) ?? 0) + 1);
    }
  }

  const content = isPortableStory ? (
    <Story {...storyContext} />
  ) : (
    <ErrorBoundary
      key={`${storyContext.id}-${remountCounts.get(canvasElement) ?? 0}`}
      showMain={showMain}
      showException={showException}
    >
      <Story {...storyContext} />
    </ErrorBoundary>
  );

  // For React 15, StrictMode & Fragment doesn't exists.
  const element = Wrapper ? <Wrapper>{content}</Wrapper> : content;

  // Disable act in docs, see:
  // https://github.com/storybookjs/storybook/issues/30356
  const act = await getAct({ disableAct: storyContext.viewMode === 'docs' });
  await new Promise<void>(async (resolve, reject) => {
    actQueue.push(async () => {
      try {
        await act(async () => {
          await renderElement(element, canvasElement, storyContext?.parameters?.react?.rootOptions);
        });
        resolve();
      } catch (e) {
        reject(e);
      }
    });
    processActQueue();
  });

  return async () => {
    await act(() => {
      unmountElement(canvasElement);
    });
  };
}
