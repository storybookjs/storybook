import { styled } from 'storybook/theming';

import { headerCommon, withReset } from '../lib/common';

export const H6 = styled.h6(withReset, headerCommon, {
  fontSize: 'var(--sb-typography-size-s2)',
  color: 'var(--sb-color-dark)',
});
