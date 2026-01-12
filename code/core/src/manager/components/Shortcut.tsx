import React from 'react';

import { shortcutToHumanString } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

const Wrapper = styled.span(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 16,
  fontSize: '11px',
  fontWeight: 'var(--sb-typography-weight-regular)',
  background: theme.base === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
  color: theme.base === 'light' ? 'var(--sb-color-dark)' : 'var(--sb-textMutedColor)',
  borderRadius: 2,
  userSelect: 'none',
  pointerEvents: 'none',
  padding: '0 4px',
}));

const Key = styled.kbd({
  padding: 0,
  fontFamily: 'var(--sb-typography-fonts-base)',
  verticalAlign: 'middle',
  '& + &': {
    marginLeft: 6,
  },
});

export const Shortcut = ({ keys }: { keys: string[] }) => (
  <Wrapper>
    {keys.map((key) => (
      <Key key={key}>{shortcutToHumanString([key])}</Key>
    ))}
  </Wrapper>
);
