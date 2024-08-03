import type { FC } from 'react';
import React from 'react';
import { transparentize } from 'polished';
import { styled } from 'storybook/internal/theming';
import { withReset } from 'storybook/internal/components';

const Wrapper = styled.div(withReset, ({ theme }) => ({
  backgroundColor: theme.base === 'light' ? 'rgba(0,0,0,.01)' : 'rgba(255,255,255,.01)',
  borderRadius: theme.appBorderRadius,
  border: `1px dashed ${theme.appBorderColor}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  margin: '25px 0 40px',

  color: transparentize(0.3, theme.color.defaultText),
  fontSize: theme.typography.size.s2,
}));

export const EmptyBlock: FC<
  React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>
> = (props) => <Wrapper {...props} className="docblock-emptyblock sb-unstyled" />;
