import type { FC } from 'react';
import React from 'react';

import { styled } from 'storybook/theming';

import { A11yStatement } from '../components/a11y/A11yStatement';

const MainWrapper = styled.main(({ theme }) => ({
  fontSize: theme.typography.size.s2,
  padding: `3rem 20px`,
  maxWidth: 600,
  margin: '0 auto',
}));

const A11yStatementPage: FC = () => (
  <MainWrapper>
    <A11yStatement />
  </MainWrapper>
);

export { A11yStatementPage };
