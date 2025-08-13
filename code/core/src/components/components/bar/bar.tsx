import type { ComponentProps, FC } from 'react';
import React, { Children, useRef } from 'react';

import { useToolbar } from '@react-aria/toolbar';
import { styled } from 'storybook/theming';

import type { ScrollAreaProps } from '../ScrollArea/ScrollArea';
import { ScrollArea } from '../ScrollArea/ScrollArea';

export interface SideProps {
  left?: boolean;
  right?: boolean;
  scrollable?: boolean;
}

export const Side = styled.div<SideProps>(
  {
    display: 'flex',
    whiteSpace: 'nowrap',
    flexBasis: 'auto',
    marginLeft: 3,
    marginRight: 10,
  },
  ({ scrollable }) => (scrollable ? { flexShrink: 0 } : {}),
  ({ left }) =>
    left
      ? {
          '& > *': {
            marginLeft: 4,
          },
        }
      : {},
  ({ right }) =>
    right
      ? {
          gap: 6,
        }
      : {}
);
Side.displayName = 'Side';

export interface BarProps extends ScrollAreaProps {
  backgroundColor?: string;
  border?: boolean;
  className?: string;
  scrollable?: boolean;

  /** Backwards compatibility: we ask callees to opt into aria toolbar semantics. */
  isAriaToolbar?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}
const StyledBar = styled.div<BarProps>(
  ({ backgroundColor, theme, scrollable = true }) => ({
    color: theme.barTextColor,
    width: '100%',
    minHeight: 40,
    flexShrink: 0,
    scrollbarColor: `${theme.barTextColor} ${backgroundColor || theme.barBg}`,
    scrollbarWidth: 'thin',
    overflow: scrollable ? 'auto' : 'hidden',
    overflowY: 'hidden',
  }),
  ({ theme, border = false }) =>
    border
      ? {
          boxShadow: `${theme.appBorderColor}  0 -1px 0 0 inset`,
          background: theme.barBg,
        }
      : {}
);

export const Bar: FC<BarProps> = ({ isAriaToolbar = false, scrollable, className, ...rest }) => {
  const toolbarRef = useRef<HTMLDivElement>(null);

  const { toolbarProps } = useToolbar(
    {
      'aria-label': rest['aria-label'],
      'aria-labelledby': rest['aria-labelledby'],
      orientation: 'horizontal',
    },
    toolbarRef
  );

  const finalRestProps = isAriaToolbar
    ? {
        ...rest,
        ...toolbarProps,
        ref: toolbarRef,
      }
    : rest;

  if (scrollable) {
    return (
      <ScrollArea vertical={false} className={className}>
        <StyledBar {...finalRestProps} />
      </ScrollArea>
    );
  }

  return <StyledBar {...finalRestProps} className={className} />;
};

Bar.displayName = 'Bar';

interface BarInnerProps {
  bgColor?: string;
}
const BarInner = styled.div<BarInnerProps>(({ bgColor }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  position: 'relative',
  flexWrap: 'nowrap',
  flexShrink: 0,
  height: 40,
  backgroundColor: bgColor || '',
}));

export interface FlexBarProps extends ComponentProps<typeof Bar> {
  border?: boolean;
  backgroundColor?: string;
}

export const FlexBar = ({ children, backgroundColor, className, ...rest }: FlexBarProps) => {
  const [left, right] = Children.toArray(children);
  return (
    <Bar backgroundColor={backgroundColor} className={`sb-bar ${className}`} {...rest}>
      <BarInner bgColor={backgroundColor}>
        <Side scrollable={rest.scrollable} left>
          {left}
        </Side>
        {right ? <Side right>{right}</Side> : null}
      </BarInner>
    </Bar>
  );
};
FlexBar.displayName = 'FlexBar';
