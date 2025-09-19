import React, { Children, forwardRef } from 'react';

import { deprecate } from 'storybook/internal/client-logger';

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
          background: backgroundColor || theme.barBg,
        }
      : {}),
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
  ({ scrollable = true, className, children, innerStyle, ...rest }, ref) => {
    return (
      <StyledBar
        {...rest}
        ref={ref}
        innerStyle={scrollable ? undefined : innerStyle}
        scrollable={scrollable}
        className={className}
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

export interface FlexBarProps extends BarProps {
  border?: boolean;
  backgroundColor?: string;
}

export const FlexBar = ({ children, backgroundColor, className, ...rest }: FlexBarProps) => {
  deprecate('FlexBar is deprecated. Use Bar with justifyContent: "space-between" instead.');
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
