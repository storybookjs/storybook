import type { CSSObject } from 'storybook/theming';
import { styled } from 'storybook/theming';

import { headerCommon, withReset } from '../lib/common';

export const H1 = styled.h1(({ theme }) => ({
  ...(withReset({ theme }) as CSSObject),
  ...(headerCommon({ theme }) as CSSObject),
  fontSize: `${theme.typography.size.l1}px`,
  fontWeight: theme.typography.weight.bold,
}));
