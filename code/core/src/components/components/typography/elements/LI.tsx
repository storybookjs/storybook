import type { CSSObject } from 'storybook/internal/theming';
import { styled } from 'storybook/internal/theming';

import { codeCommon, withReset } from '../lib/common';

export const LI = styled.li(withReset, ({ theme }) => ({
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
