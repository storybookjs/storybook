import React from 'react';

import { styled } from 'storybook/theming';

/** Wide enough for a label to stay on one line, narrow enough that a sentence stays a note. */
const DEFAULT_MAX_WIDTH = 260;

const Note = styled.div<{ maxWidth: number }>(
  ({ theme }) => ({
    fontFamily: theme.typography.fonts.base,
    padding: '2px 6px',
    lineHeight: '16px',
    fontSize: 10,
    fontWeight: theme.typography.weight.bold,
    color: theme.color.lightest,
    boxShadow: '0 0 5px 0 rgba(0, 0, 0, 0.3)',
    borderRadius: 4,
    pointerEvents: 'none',
    zIndex: -1,
    background: theme.base === 'light' ? 'rgba(60, 60, 60, 0.9)' : 'rgba(0, 0, 0, 0.95)',
  }),
  ({ maxWidth }) => ({ maxWidth })
);

export interface TooltipNoteProps {
  note: string;
  maxWidth?: number;
}

export const TooltipNote = ({ note, maxWidth = DEFAULT_MAX_WIDTH, ...props }: TooltipNoteProps) => {
  return (
    <Note maxWidth={maxWidth} {...props}>
      {note}
    </Note>
  );
};
