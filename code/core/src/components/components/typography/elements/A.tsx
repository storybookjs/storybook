import { styled } from 'storybook/theming';

import { withReset } from '../lib/common';
import { Link } from './Link';

export const A = styled(Link)(withReset, ({ theme }) => ({
  fontSize: 'inherit',
  lineHeight: '24px',

  color: theme.color.secondary,
  textDecoration: 'none',
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
  },
  '& code': {
    color: 'inherit',
    textDecoration: 'underline',
    textDecorationThickness: '1px',
    paddingLeft: 0,
    paddingRight: 0,
    '&::before': {
      content: '"\\00a0"',
      fontSize: '0.5em',
    },
    '&::after': {
      content: '"\\00a0"',
      fontSize: '0.5em',
    },
  },
}));
