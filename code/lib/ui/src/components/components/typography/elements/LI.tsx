import type { CSSObject } from '@storybook/ui/theming';
import { styled } from '@storybook/ui/theming';

import { codeCommon, withReset } from '../lib/common.tsx';

export const LI = styled.li(({ theme }) => ({
  ...(withReset({ theme }) as CSSObject),
  fontSize: theme.typography.size.s2,
  color: theme.color.defaultText,
  lineHeight: '24px',
  '& + li': {
    marginTop: '.25em',
  },
  '& ul, & ol': {
    marginTop: '.25em',
    marginBottom: 0,
  },
  '& code': codeCommon({ theme }) as CSSObject,
}));
