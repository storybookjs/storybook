import { type CSSObject, styled } from 'storybook/theming/emotion';

import { headerCommon, withReset } from '../lib/common.tsx';

export const H3 = styled.h3(({ theme }) => ({
  ...(withReset({ theme }) as CSSObject),
  ...(headerCommon({ theme }) as CSSObject),
  fontSize: `${theme.typography.size.m1}px`,
}));
