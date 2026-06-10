import React, { type FC, type ReactNode, useEffect, useRef } from 'react';

import { styled } from 'storybook/theming';

const NARROW_HEADER_WIDTH = 870;

const Root = styled.header<{ $variant: 'page' | 'toolbar' }>(({ theme, $variant }) => ({
  containerType: 'inline-size',
  containerName: 'review-header',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  width: '100%',
  background: $variant === 'toolbar' ? theme.barBg : theme.background.content,
  color: theme.color.defaultText,
  ...($variant === 'page' ? { borderBottom: `1px solid ${theme.appBorderColor}` } : {}),
}));

const TopRow = styled.div<{ $variant: 'page' | 'toolbar' }>(({ $variant }) => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  padding: $variant === 'toolbar' ? '16px 10px 8px 10px' : '16px 16px 16px 10px',
  minHeight: 40,
  [`@container review-header (max-width: ${NARROW_HEADER_WIDTH}px)`]: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
}));

const Main = styled.div({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  flex: '1 1 auto',
  minWidth: 0,
});

const Leading = styled.div({
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
});

const TextBlock = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  flexGrow: 1,
  minWidth: 0,
});

const Title = styled.h1(({ theme }) => ({
  margin: 0,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: theme.typography.size.m1,
  fontWeight: theme.typography.weight.bold,
  lineHeight: '24px',
  // The heading is only focused programmatically on route change (see
  // autoFocusTitle); it is not an interactive control, so suppress the ring.
  '&:focus': {
    outline: 'none',
  },
}));

const Subtitle = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  color: theme.textMutedColor,
  fontSize: theme.typography.size.s2,
  lineHeight: '20px',
}));

const Actions = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
  [`@container review-header (max-width: ${NARROW_HEADER_WIDTH}px)`]: {
    width: '100%',
    justifyContent: 'flex-end',
  },
});

const SecondRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 16px 2px 16px',
  minHeight: 39,
});

export interface ReviewHeaderProps {
  /** Optional control rendered before the title (e.g. a back button). */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Trailing cluster on the right of the top row. */
  actions?: ReactNode;
  /** Optional full-width second row (e.g. search or comparison controls). */
  secondRow?: ReactNode;
  /**
   * Move keyboard focus to the title heading on mount. Used on route changes
   * (e.g. opening the detail screen) so assistive tech lands on the new view's
   * heading instead of being left on the now-unmounted trigger.
   */
  autoFocusTitle?: boolean;
  /** Compact layout for the preview toolbar header row. */
  variant?: 'page' | 'toolbar';
}

export const ReviewHeader: FC<ReviewHeaderProps> = ({
  leading,
  title,
  subtitle,
  actions,
  secondRow,
  autoFocusTitle = false,
  variant = 'page',
}) => {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (autoFocusTitle) {
      titleRef.current?.focus();
    }
  }, [autoFocusTitle]);

  return (
    <Root $variant={variant}>
      <TopRow $variant={variant}>
        <Main>
          {leading ? <Leading>{leading}</Leading> : null}
          <TextBlock>
            <Title ref={titleRef} tabIndex={autoFocusTitle ? -1 : undefined}>
              {title}
            </Title>
            {subtitle ? <Subtitle>{subtitle}</Subtitle> : null}
          </TextBlock>
        </Main>
        {actions ? <Actions>{actions}</Actions> : null}
      </TopRow>
      {secondRow ? <SecondRow>{secondRow}</SecondRow> : null}
    </Root>
  );
};
