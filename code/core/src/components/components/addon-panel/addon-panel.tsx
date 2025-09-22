import type { ReactElement } from 'react';
import React, { useEffect, useRef } from 'react';

import { ScrollArea } from 'storybook/internal/components';

import { styled } from 'storybook/theming';

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
  active: boolean;
  children: ReactElement;
  hasScrollbar?: boolean;
}

const Div = styled.div({
  height: '100%',
});

export const AddonPanel = ({ active, children, hasScrollbar = true }: AddonPanelProps) => {
  return (
    // the hidden attribute is an valid html element that's both accessible and works to visually hide content
    <Div hidden={!active}>
      {hasScrollbar ? (
        <ScrollArea vertical>{useUpdate(active, children)}</ScrollArea>
      ) : (
        useUpdate(active, children)
      )}
    </Div>
  );
};
