import type { ReactElement } from 'react';
import React, { useEffect, useRef } from 'react';

import { styled } from 'storybook/theming';

import { ScrollArea } from '../ScrollArea/ScrollArea.tsx';

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
  /** Whether the panel has a vertical scrollbar, `true` by default. */
  hasScrollbar?: boolean;
  /** Whether the panel has an horizontal scrollbar, `false` by default */
  hasHorizontalScrollbar?: boolean;
}

const Div = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2 - 1,
  height: '100%',
}));

export const AddonPanel = ({
  active,
  children,
  hasScrollbar = true,
  hasHorizontalScrollbar = false,
}: AddonPanelProps) => {
  return (
    // the hidden attribute is an valid html element that's both accessible and works to visually hide content
    <Div hidden={!active}>
      {hasScrollbar || hasHorizontalScrollbar ? (
        <ScrollArea vertical={hasScrollbar} horizontal={hasHorizontalScrollbar}>
          {useUpdate(active, children)}
        </ScrollArea>
      ) : (
        useUpdate(active, children)
      )}
    </Div>
  );
};
