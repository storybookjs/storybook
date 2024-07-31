import { styled } from '@storybook/core/theming';
import { withReset } from '../lib/common';

export const Span = styled.span(withReset, ({ theme }) => ({
  '&.frame': {
    display: 'block',
    overflow: 'hidden',

    '& > span': {
      border: `1px solid ${theme.color.medium}`,
      display: 'block',
      float: 'left',
      overflow: 'hidden',
      margin: '13px 0 0',
      padding: 7,
      width: 'auto',
    },
    '& span img': {
      display: 'block',
      float: 'left',
    },
    '& span span': {
      clear: 'both',
      color: theme.color.darkest,
      display: 'block',
      padding: '5px 0 0',
    },
  },
  '&.align-center': {
    display: 'block',
    overflow: 'hidden',
    clear: 'both',

    '& > span': {
      display: 'block',
      overflow: 'hidden',
      margin: '13px auto 0',
      textAlign: 'center',
    },
    '& span img': {
      margin: '0 auto',
      textAlign: 'center',
    },
  },
  '&.align-right': {
    display: 'block',
    overflow: 'hidden',
    clear: 'both',

    '& > span': {
      display: 'block',
      overflow: 'hidden',
      margin: '13px 0 0',
      textAlign: 'right',
    },
    '& span img': {
      margin: 0,
      textAlign: 'right',
    },
  },
  '&.float-left': {
    display: 'block',
    marginRight: 13,
    overflow: 'hidden',
    float: 'left',
    '& span': {
      margin: '13px 0 0',
    },
  },
  '&.float-right': {
    display: 'block',
    marginLeft: 13,
    overflow: 'hidden',
    float: 'right',

    '& > span': {
      display: 'block',
      overflow: 'hidden',
      margin: '13px auto 0',
      textAlign: 'right',
    },
  },
}));
