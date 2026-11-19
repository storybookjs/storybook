import { type CSSObject, styled } from 'storybook/theming/emotion';

import { headerCommon, withReset } from '../lib/common.tsx';

export const H2 = styled.h2(({ theme }) => ({
  ...(withReset({ theme }) as CSSObject),
  ...(headerCommon({ theme }) as CSSObject),
  fontSize: `${theme.typography.size.m2}px`,
  paddingBottom: 4,
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));
