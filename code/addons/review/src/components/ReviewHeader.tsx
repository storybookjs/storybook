import React, { type FC, type ReactNode, useEffect, useRef } from 'react';

import { styled } from 'storybook/theming';

const Root = styled.header(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  background: theme.background.content,
  color: theme.color.defaultText,
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));

const TopRow = styled.div({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: 8,
  padding: '16px 16px 8px 16px',
  minHeight: 40,
  '&:last-of-type': {
    paddingBottom: 16,
  },
});

const Leading = styled.div({
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
});

const TextBlock = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
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
  alignItems: 'center',
  gap: 5,
  minWidth: 0,
  color: theme.textMutedColor,
  fontSize: theme.typography.size.s2,
  lineHeight: '20px',
}));

const Actions = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
});

const SecondRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px 8px 16px',
  minHeight: 40,
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
}

export const ReviewHeader: FC<ReviewHeaderProps> = ({
  leading,
  title,
  subtitle,
  actions,
  secondRow,
  autoFocusTitle = false,
}) => {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (autoFocusTitle) {
      titleRef.current?.focus();
    }
  }, [autoFocusTitle]);

  return (
    <Root>
      <TopRow>
        {leading ? <Leading>{leading}</Leading> : null}
        <TextBlock>
          <Title ref={titleRef} tabIndex={autoFocusTitle ? -1 : undefined}>
            {title}
          </Title>
          {subtitle ? <Subtitle>{subtitle}</Subtitle> : null}
        </TextBlock>
        {actions ? <Actions>{actions}</Actions> : null}
      </TopRow>
      {secondRow ? <SecondRow>{secondRow}</SecondRow> : null}
    </Root>
  );
};
