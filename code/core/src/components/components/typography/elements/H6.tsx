import { styled } from '@storybook/core/theming';

import { headerCommon, withReset } from '../lib/common';

export const H6 = styled.h6(withReset, headerCommon, ({ theme }) => ({
  fontSize: `${theme.typography.size.s2}px`,
  color: theme.color.dark,
}));
