import React, { useEffect, useRef, useState } from 'react';

import { STORY_RENDER_PHASE_CHANGED } from 'storybook/internal/core-events';

import { addons } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { EmptyTabContent } from '../tabs/EmptyTabContent';

const PanelWrapper = styled.div({
  height: '100%',
});

export const ErrorHandler = ({
  children,
  hidden,
}: {
  children: React.ReactNode;
  hidden: boolean;
}) => {
  const [hasError, setHasError] = useState(false);

  const channel = addons.getChannel();
  useEffect(() => {
    const callback = ({ newPhase }: { newPhase: string }) => {
      if (newPhase === 'rendering') {
        setHasError(false);
      } else if (newPhase === 'errored') {
        setHasError(true);
      }
    };
    channel.on(STORY_RENDER_PHASE_CHANGED, callback);
    return () => channel.off(STORY_RENDER_PHASE_CHANGED, callback);
  }, [channel]);

  return hasError ? (
    <EmptyTabContent
      title="Story failed to render"
      description="Resolve issues in your story to continue."
      hidden={hidden}
    />
  ) : (
    <PanelWrapper hidden={hidden}>{children}</PanelWrapper>
  );
};

const usePrevious = (value: any) => {
  const ref = useRef();

  useEffect(() => {
    // happens after return
    ref.current = value;
  }, [value]);

  return ref.current;
};

const useUpdate = (update: boolean, value: any) => {
  const previousValue = usePrevious(value);

  return update ? value : previousValue;
};

export interface AddonPanelProps {
  active?: boolean;
  allowError?: boolean;
  children: React.ReactNode;
}

export const AddonPanel = ({ active = false, allowError = true, children }: AddonPanelProps) => {
  return allowError ? (
    // the hidden attribute is an valid html element that's both accessible and works to visually hide content
    <PanelWrapper hidden={!active}>{useUpdate(active, children)}</PanelWrapper>
  ) : (
    <ErrorHandler hidden={!active}>{useUpdate(active, children)}</ErrorHandler>
  );
};
