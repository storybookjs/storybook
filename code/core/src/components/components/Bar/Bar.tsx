import React, { forwardRef } from 'react';

import { type CSSObject, styled } from 'storybook/theming';

export interface BarProps {
  backgroundColor?: string;
  border?: boolean;
  className?: string;
  children?: React.ReactNode;
  scrollable?: boolean;
  innerStyle?: CSSObject;
}

const StyledBar = styled.div<BarProps>(
  ({ backgroundColor, border = false, innerStyle = {}, scrollable, theme }) => ({
    color: theme.barTextColor,
    width: '100%',
    minHeight: 40,
    flexShrink: 0,
    scrollbarColor: `${theme.barTextColor} ${backgroundColor || theme.barBg}`,
    scrollbarWidth: 'thin',
    overflow: scrollable ? 'auto' : 'hidden',
    overflowY: 'hidden',
    display: 'flex',
    alignItems: 'center',
    gap: scrollable ? 0 : 6,
    paddingInline: scrollable ? 0 : 6,
    ...(border
      ? {
          boxShadow: `${theme.appBorderColor}  0 -1px 0 0 inset`,
        }
      : {}),
    background: backgroundColor || theme.barBg,
    ...innerStyle,
  })
);

const HeightPreserver = styled.div<Pick<BarProps, 'innerStyle'>>(({ innerStyle }) => ({
  minHeight: 40,
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  gap: 6,
  paddingInline: 6,
  ...innerStyle,
}));

export const Bar = forwardRef<HTMLDivElement, BarProps>(
  ({ scrollable = true, children, innerStyle, ...rest }, ref) => {
    return (
      <StyledBar
        {...rest}
        ref={ref}
        innerStyle={scrollable ? undefined : innerStyle}
        scrollable={scrollable}
      >
        {scrollable ? (
          <HeightPreserver innerStyle={innerStyle}>{children}</HeightPreserver>
        ) : (
          children
        )}
      </StyledBar>
    );
  }
);

Bar.displayName = 'Bar';
