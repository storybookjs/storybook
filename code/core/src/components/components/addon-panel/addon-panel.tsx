import React, { useEffect, useRef, useState } from 'react';

import { STORY_RENDER_PHASE_CHANGED } from 'storybook/internal/core-events';

import { useChannel } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

const PanelWrapper = styled.div({
  minHeight: '100%',
});

const ErrorWrapper = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100%',
  padding: 30,
  gap: 4,
  '& > *': {
    margin: 0,
    maxWidth: 415,
  },
  p: {
    color: theme.textMutedColor,
  },
}));

export const ErrorHandler = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);

  useChannel(
    {
      [STORY_RENDER_PHASE_CHANGED]: ({ newPhase }) => {
        if (newPhase === 'rendering') {
          setHasError(false);
        } else if (newPhase === 'errored') {
          setHasError(true);
        }
      },
    },
    []
  );

  return hasError ? (
    <ErrorWrapper>
      <strong>Story failed to render</strong>
      <p>Resolve issues in your story to continue.</p>
    </ErrorWrapper>
  ) : (
    children
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
  return (
    // the hidden attribute is an valid html element that's both accessible and works to visually hide content
    <PanelWrapper hidden={!active}>
      {allowError ? (
        useUpdate(active, children)
      ) : (
        <ErrorHandler>{useUpdate(active, children)}</ErrorHandler>
      )}
    </PanelWrapper>
  );
};
