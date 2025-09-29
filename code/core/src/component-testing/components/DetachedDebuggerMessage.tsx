import React from 'react';

import { Link } from 'storybook/internal/components';

import { styled } from 'storybook/theming';

import { PANEL_ID } from '../constants';

const Wrapper = styled.div(({ theme: { color, typography, background } }) => ({
  textAlign: 'start',
  padding: '11px 15px',
  fontSize: `${typography.size.s2 - 1}px`,
  fontWeight: typography.weight.regular,
  lineHeight: '1rem',
  background: background.app,
  borderBottom: `1px solid ${color.border}`,
  color: color.defaultText,
  backgroundClip: 'padding-box',
  position: 'relative',
}));

export const DetachedDebuggerMessage = ({ storyUrl }: { storyUrl: string }) => {
  return (
    <Wrapper>
      Debugger controls are not available on composed Storybooks.{' '}
      <Link
        href={`${storyUrl}&addonPanel=${PANEL_ID}`}
        target="_blank"
        rel="noopener noreferrer"
        withArrow
      >
        Open in external Storybook
      </Link>
    </Wrapper>
  );
};
