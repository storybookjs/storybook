import { styled } from '@storybook/core/theming';

import { headerCommon, withReset } from '../lib/common';

export const H1 = styled.h1(withReset, headerCommon, ({ theme }) => ({
  fontSize: `${theme.typography.size.l1}px`,
  fontWeight: theme.typography.weight.bold,
}));
