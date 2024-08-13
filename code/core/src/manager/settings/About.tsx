import type { FC } from 'react';
import React from 'react';

import { Button, Link, StorybookLogo } from '@storybook/core/components';
import { styled } from '@storybook/core/theming';
import { DocumentIcon, GithubIcon } from '@storybook/icons';

import { UpgradeBlock } from '../components/upgrade/UpgradeBlock';

const Container = styled.div({
  display: 'flex',
  alignItems: 'center',
  flexDirection: 'column',
  marginTop: 40,
});

const Header = styled.header({
  marginBottom: 32,
  alignItems: 'center',
  display: 'flex',

  '> svg': {
    height: 48,
    width: 'auto',
    marginRight: 8,
  },
});

const Footer = styled.div(({ theme }) => ({
  marginBottom: 24,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  color: theme.base === 'light' ? theme.color.dark : theme.color.lightest,
  fontWeight: theme.typography.weight.regular,
  fontSize: theme.typography.size.s2,
}));

const Actions = styled.div({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 24,
  marginTop: 24,
  gap: 16,
});

const StyledLink = styled(Link as any)(({ theme }) => ({
  '&&': {
    fontWeight: theme.typography.weight.bold,
    color: theme.base === 'light' ? theme.color.dark : theme.color.light,
  },
  '&:hover': {
    color: theme.base === 'light' ? theme.color.darkest : theme.color.lightest,
  },
}));

const AboutScreen: FC<{ onNavigateToWhatsNew?: () => void }> = ({ onNavigateToWhatsNew }) => {
  return (
    <Container>
      <Header>
        <StorybookLogo alt="Storybook" />
      </Header>
      <UpgradeBlock onNavigateToWhatsNew={onNavigateToWhatsNew} />
      <Footer>
        <Actions>
          <Button asChild>
            <a href="https://github.com/storybookjs/storybook">
              <GithubIcon />
              GitHub
            </a>
          </Button>
          <Button asChild>
            <a href="https://storybook.js.org/docs">
              <DocumentIcon style={{ display: 'inline', marginRight: 5 }} />
              Documentation
            </a>
          </Button>
        </Actions>
        <div>
          Open source software maintained by{' '}
          <StyledLink href="https://www.chromatic.com/">Chromatic</StyledLink> and the{' '}
          <StyledLink href="https://github.com/storybookjs/storybook/graphs/contributors">
            Storybook Community
          </StyledLink>
        </div>
      </Footer>
    </Container>
  );
};

export { AboutScreen };
