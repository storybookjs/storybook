import { styled } from 'storybook/theming';

import { withReset } from '../lib/common';
import { Link } from './Link';

export const A = styled(Link)(withReset, ({ theme }) => ({
  fontSize: 'inherit',
  lineHeight: '24px',

  color: theme.color.secondary,
  // Ensure WCAG Level A compliance (SC 1.4.1), see https://www.w3.org/WAI/WCAG22/Techniques/failures/F73
  textDecoration: 'underline',
  textDecorationThickness: '0.5px',
  textUnderlineOffset: '0.11em',
  '&.absent': {
    color: '#cc0000',
  },
  '&.anchor': {
    display: 'block',
    paddingLeft: 30,
    marginLeft: -30,
    cursor: 'pointer',
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    textDecoration: 'none',
  },
}));
