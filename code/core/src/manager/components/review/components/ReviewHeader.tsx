import React, { type FC, type ReactNode, useRef } from 'react';

import { useId } from 'react-aria/useId';
import { styled } from 'storybook/theming';
import { useLandmark } from '../../../hooks/useLandmark.ts';

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
  flexWrap: 'wrap',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  padding: $variant === 'toolbar' ? '16px 16px 8px 16px' : '16px',
  minHeight: 40,
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
  alignSelf: 'flex-start',
  flexShrink: 0,
});

const TextBlock = styled.div({
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1,
  minWidth: 0,
});

const Title = styled.h1(({ theme }) => ({
  margin: '2px 0',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: theme.typography.size.m1,
  fontWeight: theme.typography.weight.bold,
  lineHeight: '24px',
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
  justifyContent: 'flex-end',
  gap: 6,
  flex: '0 1 auto',
  marginLeft: 'auto',
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
  /** Compact layout for the preview toolbar header row. */
  variant?: 'page' | 'toolbar';
}

export const ReviewHeader: FC<ReviewHeaderProps> = ({
  leading,
  title,
  subtitle,
  actions,
  secondRow,
  variant = 'page',
}) => {
  const titleId = useId();
  const regionRef = useRef<HTMLElement>(null);

  const { landmarkProps } = useLandmark({ 'aria-labelledby': titleId, role: 'banner' }, regionRef);

  return (
    <Root $variant={variant} ref={regionRef} {...landmarkProps}>
      <TopRow $variant={variant}>
        <Main>
          {leading ? <Leading>{leading}</Leading> : null}
          <TextBlock>
            <Title id={titleId}>{title}</Title>
            {subtitle ? <Subtitle>{subtitle}</Subtitle> : null}
          </TextBlock>
        </Main>
        {actions ? <Actions>{actions}</Actions> : null}
      </TopRow>
      {secondRow ? <SecondRow>{secondRow}</SecondRow> : null}
    </Root>
  );
};
