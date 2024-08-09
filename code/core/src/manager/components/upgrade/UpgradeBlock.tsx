import type { FC } from 'react';
import React, { useState } from 'react';

import { Link } from '@storybook/core/components';
import { styled } from '@storybook/core/theming';

import { useStorybookApi } from '@storybook/core/manager-api';

import { MEDIA_DESKTOP_BREAKPOINT } from '../../constants';

interface UpgradeBlockProps {
  onNavigateToWhatsNew?: () => void;
}

export const UpgradeBlock: FC<UpgradeBlockProps> = ({ onNavigateToWhatsNew }) => {
  const api = useStorybookApi();
  const [activeTab, setActiveTab] = useState<'npm' | 'pnpm'>('npm');

  return (
    <Container>
      <strong>You are on Storybook {api.getCurrentVersion().version}</strong>
      <p>Run the following script to check for updates and upgrade to the latest version.</p>
      <Tabs>
        <ButtonTab active={activeTab === 'npm'} onClick={() => setActiveTab('npm')}>
          npm
        </ButtonTab>
        <ButtonTab active={activeTab === 'pnpm'} onClick={() => setActiveTab('pnpm')}>
          pnpm
        </ButtonTab>
      </Tabs>
      <Code>
        {activeTab === 'npm' ? 'npx storybook@latest upgrade' : 'pnpm dlx storybook@latest upgrade'}
      </Code>
      {onNavigateToWhatsNew && (
        // eslint-disable-next-line jsx-a11y/anchor-is-valid
        <Link onClick={onNavigateToWhatsNew}>See what's new in Storybook</Link>
      )}
    </Container>
  );
};

const Container = styled.div(({ theme }) => ({
  border: '1px solid',
  borderRadius: 5,
  padding: 20,
  marginTop: 0,
  borderColor: theme.appBorderColor,
  fontSize: theme.typography.size.s2,
  width: '100%',

  [MEDIA_DESKTOP_BREAKPOINT]: {
    maxWidth: 400,
  },
}));

const Tabs = styled.div({
  display: 'flex',
  gap: 2,
});

const Code = styled.pre(({ theme }) => ({
  background: theme.base === 'light' ? 'rgba(0, 0, 0, 0.05)' : theme.appBorderColor,
  fontSize: theme.typography.size.s2 - 1,
  margin: '4px 0 16px',
}));

const ButtonTab = styled.button<{ active: boolean }>(({ theme, active }) => ({
  all: 'unset',
  alignItems: 'center',
  gap: 10,
  color: theme.color.defaultText,
  fontSize: theme.typography.size.s2 - 1,
  borderBottom: '2px solid transparent',
  borderBottomColor: active ? theme.color.secondary : 'none',
  padding: '0 10px 5px',
  marginBottom: '5px',
  cursor: 'pointer',
}));
