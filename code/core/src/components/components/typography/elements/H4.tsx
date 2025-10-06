import { styled } from 'storybook/theming';

import { headerCommon, withReset } from '../lib/common';

export const H4 = styled.h4(withReset, headerCommon, ({ theme }) => ({
  fontSize: `${theme.typography.size.s3}px`,
}));
