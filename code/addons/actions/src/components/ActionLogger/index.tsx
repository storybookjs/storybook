import type { ElementRef, ReactNode } from 'react';
import React, { Fragment, forwardRef, useEffect, useRef } from 'react';

import { ActionBar, ScrollArea } from 'storybook/internal/components';
import type { Theme } from 'storybook/internal/theming';
import { styled, withTheme } from 'storybook/internal/theming';

import { Inspector } from 'react-inspector';

import type { ActionDisplay } from '../../models';
import { Action, Counter, InspectorContainer } from './style';

const UnstyledWrapped = forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(
  ({ children, className }, ref) => (
    <ScrollArea ref={ref} horizontal vertical className={className}>
      {children}
    </ScrollArea>
  )
);
UnstyledWrapped.displayName = 'UnstyledWrapped';

export const Wrapper = styled(UnstyledWrapped)({
  margin: 0,
  padding: '10px 5px 20px',
});

interface InspectorProps {
  theme: Theme & { addonActionsTheme?: string };
  sortObjectKeys: boolean;
  showNonenumerable: boolean;
  name: any;
  data: any;
}

const ThemedInspector = withTheme(({ theme, ...props }: InspectorProps) => (
  <Inspector theme={theme.addonActionsTheme || 'chromeLight'} table={false} {...props} />
));

interface ActionLoggerProps {
  actions: ActionDisplay[];
  onClear: () => void;
}

export const ActionLogger = ({ actions, onClear }: ActionLoggerProps) => {
  const wrapperRef = useRef<ElementRef<typeof Wrapper>>(null);
  const wrapper = wrapperRef.current;
  const wasAtBottom = wrapper && wrapper.scrollHeight - wrapper.scrollTop === wrapper.clientHeight;

  useEffect(() => {
    // Scroll to bottom, when the action panel was already scrolled down

    // Scroll to bottom, when the action panel was already scrolled down
    if (wasAtBottom) {
      wrapperRef.current.scrollTop = wrapperRef.current.scrollHeight;
    }
  }, [wasAtBottom, actions.length]);

  return (
    <Fragment>
      <Wrapper ref={wrapperRef}>
        {actions.map((action: ActionDisplay) => (
          <Action key={action.id}>
            {action.count > 1 && <Counter>{action.count}</Counter>}
            <InspectorContainer>
              <ThemedInspector
                sortObjectKeys
                showNonenumerable={false}
                name={action.data.name}
                data={action.data.args ?? action.data}
              />
            </InspectorContainer>
          </Action>
        ))}
      </Wrapper>
      <ActionBar actionItems={[{ title: 'Clear', onClick: onClear }]} />
    </Fragment>
  );
};
