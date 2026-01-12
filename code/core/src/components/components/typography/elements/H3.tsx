import { styled } from 'storybook/theming';

import { headerCommon, withReset } from '../lib/common';

export const H3 = styled.h3(withReset, headerCommon, {
  fontSize: 'var(--sb-typography-size-m1)',
});
