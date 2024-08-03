import React from 'react';
import { ThemeProvider, convert, themes } from 'storybook/internal/theming';

export const parameters = {
  options: {
    // storySortV6: (a, b) => (
    //   a[1].kind === b[1].kind
    //     ? 0
    //     : a[1].id.localeCompare(b[1].id, undefined, { numeric: true });
    // ),
    // storySortV7: (a, b) => (
    //   a.title === b.title
    //     ? 0
    //     : a.id.localeCompare(b.id, undefined, { numeric: true });
    // ),
    storySort: {
      order: ['Examples', 'Docs', 'Demo'],
    },
  },
};

export const decorators = [
  (StoryFn) => (
    <ThemeProvider theme={convert(themes.light)}>
      <StoryFn />
    </ThemeProvider>
  ),
];
