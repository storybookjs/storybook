import React from 'react';

import { styled } from 'storybook/theming';

const Note = styled.div(({ theme }) => ({
  // Portal-rendered, so it cannot rely on inheriting a base font: the preview iframe root has
  // none, and a user's own styles may sit there instead.
  fontFamily: theme.typography.fonts.base,
  padding: '2px 6px',
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
}));

export interface TooltipNoteProps {
  note: string;
}

export const TooltipNote = ({ note, ...props }: TooltipNoteProps) => {
  return <Note {...props}>{note}</Note>;
};
