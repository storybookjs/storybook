/* oxlint-disable react-classic/destructuring-assignment */
import type { FunctionComponent } from 'react';
import React, { useEffect, useRef, useState } from 'react';

import { ErrorFormatter, Loader } from 'storybook/internal/components';
import { STORY_PREPARED, UPDATE_STORY_ARGS } from 'storybook/internal/core-events';
import type { Channel } from 'storybook/internal/channels';
import type { Args, DocsContextProps, PreparedStory } from 'storybook/internal/types';

import { isEqual } from 'es-toolkit/predicate';
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
  args?: Args;
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

const IFrameStory: FunctionComponent<IFrameStoryProps> = ({ story, height = '500px', args }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeArgs = useRef<Args | undefined>(undefined);

  useEffect(() => {
    const iframe = containerRef.current?.querySelector('iframe');
    if (!iframe || !args) {
      return () => {};
    }
    const channelOf = () =>
      (iframe.contentWindow as IFrameWindow | null)?.__STORYBOOK_ADDONS_CHANNEL__;
    const sendArgs = () => {
      const known = iframeArgs.current ?? story.initialArgs;
      const channel = channelOf();
      if (!channel || isEqual(args, known)) {
        return;
      }
      // A key the docs page dropped has to be unset in the iframe, so it is sent as `undefined`.
      const unsetKnown = Object.fromEntries(Object.keys(known).map((key) => [key, undefined]));
      channel.emit(UPDATE_STORY_ARGS, {
        storyId: story.id,
        updatedArgs: { ...unsetKnown, ...args },
      });
      iframeArgs.current = args;
    };
    // A freshly loaded iframe accepts args updates only once its preview has prepared the story.
    let unsubscribe = () => {};
    const onLoad = () => {
      iframeArgs.current = undefined;
      const channel = channelOf();
      if (!channel) {
        return;
      }
      const onPrepared = ({ id }: { id: string }) => {
        if (id !== story.id) {
          return;
        }
        unsubscribe();
        sendArgs();
      };
      channel.on(STORY_PREPARED, onPrepared);
      unsubscribe = () => channel.off(STORY_PREPARED, onPrepared);
    };
    sendArgs();
    iframe.addEventListener('load', onLoad);
    return () => {
      unsubscribe();
      iframe.removeEventListener('load', onLoad);
    };
  }, [args, story]);

  return (
    <div ref={containerRef} style={{ width: '100%', height }}>
      <ZoomContext.Consumer>
        {({ scale }) => {
          return (
            <IFrame
              key="iframe"
              id={`iframe--${story.id}`}
              title={story.name}
              src={getStoryHref(story.id, { viewMode: 'story' })}
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

interface IFrameWindow extends Window {
  __STORYBOOK_ADDONS_CHANNEL__?: Pick<Channel, 'emit' | 'on' | 'off'>;
}

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
