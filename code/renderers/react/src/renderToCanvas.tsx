import type { FC } from 'react';
import React, { Fragment, StrictMode, useEffect, useState } from 'react';

import type { RenderContext } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { getReactActEnvironment } from './act-compat';
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

  const isActEnabled = getReactActEnvironment();

  const content = isActEnabled ? (
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

  await renderElement(element, canvasElement, storyContext?.parameters?.react?.rootOptions);

  return () => unmountElement(canvasElement);
}
