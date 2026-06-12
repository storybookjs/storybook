import React from 'react';

import { styled } from 'storybook/theming';

const Note = styled.div(({ theme }) => ({
  padding: '4px 6px',
  display: 'flex',
  gap: '6px',
  lineHeight: '16px',
  fontSize: 10,
  fontWeight: theme.typography.weight.bold,
  color: theme.color.lightest,
  boxShadow: '0 0 5px 0 rgba(0, 0, 0, 0.3)',
  borderRadius: 4,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  zIndex: -1,
  background: theme.base === 'light' ? 'rgba(60, 60, 60, 0.9)' : 'rgba(0, 0, 0, 0.95)',

  '& code': {
    padding: '0 3px',
    borderRadius: '2px',
    background: 'rgba(255, 255, 255, 0.10)',
  },
}));

export interface TooltipNoteProps {
  /* The note to display. */
  note: string;
  /* The optional keyboard shortcut for the action being presented. */
  shortcut?: string;
}

export const TooltipNote = ({ note, shortcut, ...props }: TooltipNoteProps) => {
  return (
    <Note {...props}>
      <span>{note}</span>
      {shortcut && <code>{shortcut}</code>}
    </Note>
  );
};
