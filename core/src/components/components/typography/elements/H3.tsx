import { styled } from '@storybook/core/theming';

import { headerCommon, withReset } from '../lib/common';

export const H3 = styled.h3(withReset, headerCommon, ({ theme }) => ({
  fontSize: `${theme.typography.size.m1}px`,
}));
