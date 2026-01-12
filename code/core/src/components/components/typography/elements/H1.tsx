import { styled } from 'storybook/theming';

import { headerCommon, withReset } from '../lib/common';

export const H1 = styled.h1(withReset, headerCommon, {
  fontSize: 'var(--sb-typography-size-l1)',
  fontWeight: 'var(--sb-typography-weight-bold)',
});
