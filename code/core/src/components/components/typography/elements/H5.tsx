import { styled } from 'storybook/theming';

import { headerCommon, withReset } from '../lib/common';

export const H5 = styled.h5(withReset, headerCommon, {
  fontSize: 'var(--sb-typography-size-s2)',
});
