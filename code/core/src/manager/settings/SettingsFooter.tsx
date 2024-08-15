import type { FC } from 'react';
import React from 'react';

import { Link } from '@storybook/core/components';
import { styled } from '@storybook/core/theming';

const Footer = styled.div(({ theme }) => ({
  display: 'flex',
  paddingTop: 20,
  marginTop: 20,
  borderTop: `1px solid ${theme.appBorderColor}`,
  fontWeight: theme.typography.weight.bold,

  '& > * + *': {
    marginLeft: 20,
  },
}));
const SettingsFooter: FC<any> = (props) => (
  <Footer {...props}>
    <Link secondary href="https://storybook.js.org" cancel={false} target="_blank">
      Docs
    </Link>
    <Link secondary href="https://github.com/storybookjs/storybook" cancel={false} target="_blank">
      GitHub
    </Link>
    <Link
      secondary
      href="https://storybook.js.org/community#support"
      cancel={false}
      target="_blank"
    >
      Support
    </Link>
  </Footer>
);

export default SettingsFooter;
