import { type CSSObject, styled } from 'storybook/theming/emotion';

import { headerCommon, withReset } from '../lib/common.tsx';

export const H5 = styled.h5(({ theme }) => ({
  ...(withReset({ theme }) as CSSObject),
  ...(headerCommon({ theme }) as CSSObject),
  fontSize: `${theme.typography.size.s2}px`,
}));
