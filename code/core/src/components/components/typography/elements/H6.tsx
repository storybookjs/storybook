import type { CSSObject } from 'storybook/theming';
import { styled } from 'storybook/theming';

import { headerCommon, withReset } from '../lib/common';

export const H6 = styled.h6(({ theme }) => ({
  ...(withReset({ theme }) as CSSObject),
  ...(headerCommon({ theme }) as CSSObject),
  fontSize: `${theme.typography.size.s2}px`,
  color: theme.color.dark,
}));
