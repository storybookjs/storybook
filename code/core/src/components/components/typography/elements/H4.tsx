import { styled } from 'storybook/theming';

import { headerCommon, withReset } from '../lib/common';

export const H4 = styled.h4(withReset, headerCommon, {
  fontSize: 'var(--sb-typography-size-s3)',
});
