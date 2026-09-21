/* oxlint-disable react-classic/destructuring-assignment */
import type { FunctionComponent } from 'react';
import React, { useEffect, useRef, useState } from 'react';

import { ErrorFormatter, Loader } from 'storybook/internal/components';
import { UPDATE_QUERY_PARAMS } from 'storybook/internal/core-events';
import type { DocsContextProps, PreparedStory } from 'storybook/internal/types';

import { styled } from 'storybook/theming';

import { getStoryHref } from '../getStoryHref';
import { IFrame } from './IFrame';
import { ZoomContext } from './ZoomContext';

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
  /** The channel is needed to keep the iframe in sync with changes to the globals query param. */
  channel?: DocsContextProps['channel'];
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
      <div
        ref={storyRef as any}
        id={`${storyBlockIdFromId(props)}-inner`}
        data-name={story.name}
        lang={story.parameters?.htmlLang || 'en'}
      />
    </>
  );
};

/**
 * The manager renders the docs page with the selected globals (e.g. `theme:dark`) in its URL. The
 * nested story iframe only receives the initial globals of the preview if it is given them
 * explicitly, so read them from the current URL and let `UPDATE_QUERY_PARAMS` keep them up to date.
 */
const getGlobalsFromUrl = () => {
  const searchParams = new URLSearchParams(globalThis.location?.search ?? '');
  return searchParams.get('globals') ?? undefined;
};

const IFrameStory: FunctionComponent<IFrameStoryProps> = ({ story, height = '500px', channel }) => {
  const [globals, setGlobals] = useState(getGlobalsFromUrl);

  useEffect(() => {
    if (!channel) {
      return () => {};
    }
    const onUpdateQueryParams = (queryParams: Record<string, string | undefined>) => {
      setGlobals(queryParams?.globals || undefined);
    };
    channel.on(UPDATE_QUERY_PARAMS, onUpdateQueryParams);
    return () => channel.off(UPDATE_QUERY_PARAMS, onUpdateQueryParams);
  }, [channel]);

  // The IFrame component doesn't update the DOM when its props change, so a changed `globals`
  // param is applied by remounting the iframe through its `key`.
  const src = getStoryHref(
    story.id,
    globals ? { viewMode: 'story', globals } : { viewMode: 'story' }
  );

  return (
    <div style={{ width: '100%', height }}>
      <ZoomContext.Consumer>
        {({ scale }) => {
          return (
            <IFrame
              key={src}
              id={`iframe--${story.id}`}
              title={story.name}
              src={src}
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
};

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
        <a href="https://storybook.js.org/docs/api/doc-blocks/doc-block-story?ref=ui#autoplay">
          autoplay
        </a>{' '}
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
