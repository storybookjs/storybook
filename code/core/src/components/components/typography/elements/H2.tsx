import { styled } from '@storybook/core/theming';
import { withReset, headerCommon } from '../lib/common';

export const H2 = styled.h2(withReset, headerCommon, ({ theme }) => ({
  fontSize: `${theme.typography.size.m2}px`,
  paddingBottom: 4,
  borderBottom: `1px solid ${theme.appBorderColor}`,
}));
