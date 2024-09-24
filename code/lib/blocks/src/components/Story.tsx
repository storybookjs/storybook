/* eslint-disable react/destructuring-assignment */
import type { FunctionComponent } from 'react';
import React, { useEffect, useRef, useState } from 'react';

import { ErrorFormatter, Loader, getStoryHref } from 'storybook/internal/components';
import { styled } from 'storybook/internal/theming';
import type { DocsContextProps, PreparedStory } from 'storybook/internal/types';

import { global } from '@storybook/global';

import { IFrame } from './IFrame';
import { ZoomContext } from './ZoomContext';

const { PREVIEW_URL } = global;
const BASE_URL = PREVIEW_URL || 'iframe.html';

interface CommonProps {
  story: PreparedStory;
  inline: boolean;
  primary: boolean;
}

interface InlineStoryProps extends CommonProps {
  inline: true;
  height?: string;
  autoplay: boolean;
  forceInitialArgs: boolean;
  renderStoryToElement: DocsContextProps['renderStoryToElement'];
}

interface IFrameStoryProps extends CommonProps {
  inline: false;
  height: string;
}

export type StoryProps = InlineStoryProps | IFrameStoryProps;

export const storyBlockIdFromId = ({ story, primary }: StoryProps) =>
  `story--${story.id}${primary ? '--primary' : ''}`;

const InlineStory: FunctionComponent<InlineStoryProps> = (props) => {
  const storyRef = useRef();
  const [showLoader, setShowLoader] = useState(true);
  const [error, setError] = useState<Error>();

  const { story, height, autoplay, forceInitialArgs, renderStoryToElement } = props;

  useEffect(() => {
    if (!(story && storyRef.current)) {
      return () => {};
    }
    const element = storyRef.current as HTMLElement;
    const cleanup = renderStoryToElement(
      story,
      element,
      {
        showMain: () => {},
        showError: ({ title, description }: { title: string; description: string }) =>
          setError(new Error(`${title} - ${description}`)),
        showException: (err: Error) => setError(err),
      },
      { autoplay, forceInitialArgs }
    );
    setShowLoader(false);
    return () => {
      // It seems like you are supposed to unmount components outside of `useEffect`:
      //   https://github.com/facebook/react/issues/25675#issuecomment-1363957941
      Promise.resolve().then(() => cleanup());
    };
  }, [autoplay, renderStoryToElement, story]);

  if (error) {
    return (
      <pre>
        <ErrorFormatter error={error} />
      </pre>
    );
  }

  return (
    <>
      {height ? (
        <style>{`#${storyBlockIdFromId(
          props
        )} { min-height: ${height}; transform: translateZ(0); overflow: auto }`}</style>
      ) : null}
      {showLoader && <StorySkeleton />}
      <div ref={storyRef} id={`${storyBlockIdFromId(props)}-inner`} data-name={story.name} />
    </>
  );
};

const IFrameStory: FunctionComponent<IFrameStoryProps> = ({ story, height = '500px' }) => (
  <div style={{ width: '100%', height }}>
    <ZoomContext.Consumer>
      {({ scale }) => {
        return (
          <IFrame
            key="iframe"
            id={`iframe--${story.id}`}
            title={story.name}
            src={getStoryHref(BASE_URL, story.id, { viewMode: 'story' })}
            allowFullScreen
            scale={scale}
            style={{
              width: '100%',
              height: '100%',
              border: '0 none',
            }}
          />
        );
      }}
    </ZoomContext.Consumer>
  </div>
);

/** A story element, either rendered inline or in an iframe, with configurable height. */

const ErrorMessage = styled.strong(({ theme }) => ({
  color: theme.color.orange,
}));

const Story: FunctionComponent<StoryProps> = (props) => {
  const { inline, story } = props;

  if (inline && !props.autoplay && story.usesMount) {
    return (
      <ErrorMessage>
        This story mounts inside of play. Set{' '}
        <a href="https://storybook.js.org/docs/api/doc-blocks/doc-block-story#autoplay">autoplay</a>{' '}
        to true to view this story.
      </ErrorMessage>
    );
  }

  return (
    <div id={storyBlockIdFromId(props)} className="sb-story sb-unstyled" data-story-block="true">
      {inline ? (
        <InlineStory {...(props as InlineStoryProps)} />
      ) : (
        <IFrameStory {...(props as IFrameStoryProps)} />
      )}
    </div>
  );
};

const StorySkeleton = () => <Loader />;

export { Story, StorySkeleton };
