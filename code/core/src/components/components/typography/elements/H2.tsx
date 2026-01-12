import { styled } from 'storybook/theming';

import { headerCommon, withReset } from '../lib/common';

export const H2 = styled.h2(withReset, headerCommon, {
  fontSize: 'var(--sb-typography-size-m2)',
  paddingBottom: 4,
  borderBottom: `1px solid var(--sb-appBorderColor)`,
});
