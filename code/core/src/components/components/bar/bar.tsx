import type { ComponentProps } from 'react';
import React, { Children } from 'react';

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

interface UnstyledBarProps extends ScrollAreaProps {
  scrollable?: boolean;
}

const UnstyledBar = ({ children, className, scrollable }: UnstyledBarProps) =>
  scrollable ? (
    <ScrollArea vertical={false} className={className}>
      {children}
    </ScrollArea>
  ) : (
    <div className={className}>{children}</div>
  );

export interface BarProps extends UnstyledBarProps {
  backgroundColor?: string;
  border?: boolean;
}
export const Bar = styled(UnstyledBar)<BarProps>(
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
