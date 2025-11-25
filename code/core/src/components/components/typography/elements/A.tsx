import { styled } from 'storybook/theming';

import { withReset } from '../lib/common';
import { Link } from './Link';

export const A = styled(Link)(withReset, ({ theme }) => ({
  fontSize: 'inherit',
  lineHeight: '24px',

  color: theme.color.secondary,
  // Add underlines to all links for WCAG 2.1 Level A compliance (SC 1.4.1)
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
    // Anchor links are position markers and should not have underlines
    textDecoration: 'none',
  },
}));
