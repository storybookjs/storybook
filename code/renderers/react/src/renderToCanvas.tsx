import type { FC } from 'react';
import React, { Fragment, StrictMode, useEffect, useState } from 'react';

import type { RenderContext } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { act } from './act-compat';
import type { ReactRenderer, StoryContext } from './types';

const { FRAMEWORK_OPTIONS } = global;

const ErrorBoundary: FC<{
  showException: (err: Error) => void;
  showMain: () => void;
  children?: React.ReactNode;
}> = ({ showException, showMain, children }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!hasError) {
      showMain();
    }
  }, [hasError, showMain]);

  const componentDidCatch = (err: Error) => {
    showException(err);
    setHasError(true);
  };

  // We replace the lifecycle method with a try-catch block
  const errorHandler = (error: Error) => {
    componentDidCatch(error);
  };

  // Render logic after catching an error
  if (hasError) {
    return null; // or display an error fallback UI
  }

  return <>{children}</>;
};

const Wrapper = FRAMEWORK_OPTIONS?.strictMode ? StrictMode : Fragment;

const actQueue: (() => Promise<void>)[] = [];
let isActing = false;

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

  // eslint-disable-next-line no-underscore-dangle
  const isPortableStory = storyContext.parameters.__isPortableStory;

  const content = isPortableStory ? (
    <Story {...storyContext} />
  ) : (
    <ErrorBoundary showMain={showMain} showException={showException}>
      <Story {...storyContext} />
    </ErrorBoundary>
  );

  // For React 15, StrictMode & Fragment doesn't exists.
  const element = Wrapper ? <Wrapper>{content}</Wrapper> : content;

  if (forceRemount) {
    unmountElement(canvasElement);
  }

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
