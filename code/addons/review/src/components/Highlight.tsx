import React, { type FC, type ReactNode } from 'react';

import { styled } from 'storybook/theming';

const Mark = styled.mark(({ theme }) => ({
  background: theme.color.secondary,
  color: theme.color.lightest,
  borderRadius: 2,
  padding: '0 1px',
  margin: '0 -1px',
  fontWeight: 'inherit',
  '@media (forced-colors: active)': {
    color: 'HighlightText',
    background: 'Highlight',
  },
}));

// Render `text`, wrapping every case-insensitive occurrence of `query` in a
// <Mark>. With no query the text renders untouched.
export const Highlight: FC<{ text: string; query: string }> = ({ text, query }) => {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return <>{text}</>;
  }
  const haystack = text.toLowerCase();
  const segments: ReactNode[] = [];
  let cursor = 0;
  let match = haystack.indexOf(needle);
  let key = 0;
  while (match !== -1) {
    if (match > cursor) {
      segments.push(text.slice(cursor, match));
    }
    segments.push(<Mark key={key++}>{text.slice(match, match + needle.length)}</Mark>);
    cursor = match + needle.length;
    match = haystack.indexOf(needle, cursor);
  }
  if (cursor < text.length) {
    segments.push(text.slice(cursor));
  }
  return <>{segments}</>;
};
