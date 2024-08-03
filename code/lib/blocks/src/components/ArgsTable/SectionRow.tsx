import type { FC } from 'react';
import React, { useState } from 'react';
import { transparentize, lighten } from 'polished';
import { styled } from 'storybook/internal/theming';
import { ChevronDownIcon, ChevronRightIcon } from '@storybook/icons';

type Level = 'section' | 'subsection';

export interface SectionRowProps {
  children?: React.ReactNode;
  label: string;
  level: Level;
  initialExpanded?: boolean;
  colSpan: number;
}

const ExpanderIconDown = styled(ChevronDownIcon)(({ theme }) => ({
  marginRight: 8,
  marginLeft: -10,
  marginTop: -2, // optical alignment
  height: 12,
  width: 12,
  color:
    theme.base === 'light'
      ? transparentize(0.25, theme.color.defaultText)
      : transparentize(0.3, theme.color.defaultText),
  border: 'none',
  display: 'inline-block',
}));

const ExpanderIconRight = styled(ChevronRightIcon)(({ theme }) => ({
  marginRight: 8,
  marginLeft: -10,
  marginTop: -2, // optical alignment
  height: 12,
  width: 12,
  color:
    theme.base === 'light'
      ? transparentize(0.25, theme.color.defaultText)
      : transparentize(0.3, theme.color.defaultText),
  border: 'none',
  display: 'inline-block',
}));

const FlexWrapper = styled.span(({ theme }) => ({
  display: 'flex',
  lineHeight: '20px',
  alignItems: 'center',
}));

const Section = styled.td(({ theme }) => ({
  position: 'relative',
  letterSpacing: '0.35em',
  textTransform: 'uppercase',
  fontWeight: theme.typography.weight.bold,
  fontSize: theme.typography.size.s1 - 1,
  color:
    theme.base === 'light'
      ? transparentize(0.4, theme.color.defaultText)
      : transparentize(0.6, theme.color.defaultText),
  background: `${theme.background.app} !important`,
  '& ~ td': {
    background: `${theme.background.app} !important`,
  },
}));

const Subsection = styled.td(({ theme }) => ({
  position: 'relative',
  fontWeight: theme.typography.weight.bold,
  fontSize: theme.typography.size.s2 - 1,
  background: theme.background.app,
}));

const StyledTd = styled.td(() => ({
  position: 'relative',
}));

const StyledTr = styled.tr(({ theme }) => ({
  '&:hover > td': {
    backgroundColor: `${lighten(0.005, theme.background.app)} !important`,
    boxShadow: `${theme.color.mediumlight} 0 - 1px 0 0 inset`,
    cursor: 'row-resize',
  },
}));

const ClickIntercept = styled.button(() => ({
  // reset button style
  background: 'none',
  border: 'none',
  padding: '0',
  font: 'inherit',

  // add custom style
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  height: '100%',
  width: '100%',
  color: 'transparent',
  cursor: 'row-resize !important',
}));

export const SectionRow: FC<SectionRowProps> = ({
  level = 'section',
  label,
  children,
  initialExpanded = true,
  colSpan = 3,
}) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  const Level = level === 'subsection' ? Subsection : Section;
  // @ts-expect-error (Converted from ts-ignore)
  const itemCount = children?.length || 0;
  const caption = level === 'subsection' ? `${itemCount} item${itemCount !== 1 ? 's' : ''}` : '';

  const helperText = `${expanded ? 'Hide' : 'Show'} ${
    level === 'subsection' ? itemCount : label
  } item${itemCount !== 1 ? 's' : ''}`;

  return (
    <>
      <StyledTr title={helperText}>
        <Level colSpan={1}>
          <ClickIntercept onClick={(e) => setExpanded(!expanded)} tabIndex={0}>
            {helperText}
          </ClickIntercept>
          <FlexWrapper>
            {expanded ? <ExpanderIconDown /> : <ExpanderIconRight />}
            {label}
          </FlexWrapper>
        </Level>
        <StyledTd colSpan={colSpan - 1}>
          <ClickIntercept
            onClick={(e) => setExpanded(!expanded)}
            tabIndex={-1}
            style={{ outline: 'none' }}
          >
            {helperText}
          </ClickIntercept>
          {expanded ? null : caption}
        </StyledTd>
      </StyledTr>
      {expanded ? children : null}
    </>
  );
};
