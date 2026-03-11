import { withReset } from 'storybook/internal/components';

import type { CSSObject } from 'storybook/theming';
import { styled } from 'storybook/theming';

const breakpoint = 600;

export const Title = styled.h1(({ theme }) => ({
  ...(withReset({ theme }) as CSSObject),
  color: theme.color.defaultText,
  fontSize: theme.typography.size.m3,
  fontWeight: theme.typography.weight.bold,
  lineHeight: '32px',

  [`@media (min-width: ${breakpoint}px)`]: {
    fontSize: theme.typography.size.l1,
    lineHeight: '36px',
    marginBottom: '16px',
  },
}));
