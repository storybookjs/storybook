import React from 'react';

import { styled } from 'storybook/theming';

/** Wide enough for a label to stay on one line, narrow enough that a sentence stays a note. */
const DEFAULT_MAX_WIDTH = 260;

const Note = styled.div<{ maxWidth: number }>(
  ({ theme }) => ({
    padding: '4px 6px',
    display: 'flex',
    gap: '6px',
    lineHeight: '16px',
    fontSize: 10,
    fontFamily: theme.typography.fonts.base,
    fontWeight: theme.typography.weight.bold,
    color: theme.color.lightest,
    boxShadow: '0 0 5px 0 rgba(0, 0, 0, 0.3)',
    borderRadius: 4,
    pointerEvents: 'none',
    zIndex: -1,
    background: theme.base === 'light' ? 'rgba(60, 60, 60, 0.9)' : 'rgba(0, 0, 0, 0.95)',

    '& code': {
      padding: '0 3px',
      borderRadius: '2px',
      background: 'rgba(255, 255, 255, 0.10)',
    },
  }),
  ({ maxWidth }) => ({ maxWidth })
);

export interface TooltipNoteProps {
  /* The note to display. A note may also present a shortcut alone. */
  note?: string;
  /* The optional keyboard shortcut for the action being presented. */
  shortcut?: string;
  /* The maximum width of the note. */
  maxWidth?: number;
}

export const TooltipNote = ({
  note,
  maxWidth = DEFAULT_MAX_WIDTH,
  shortcut,
  ...props
}: TooltipNoteProps) => {
  return (
    <Note maxWidth={maxWidth} {...props}>
      {note && <span>{note}</span>}
      {shortcut && <code>{shortcut}</code>}
    </Note>
  );
};
