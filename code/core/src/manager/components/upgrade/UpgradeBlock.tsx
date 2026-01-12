import type { FC } from 'react';
import React, { useState } from 'react';

import { Link } from 'storybook/internal/components';

import { useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { MEDIA_DESKTOP_BREAKPOINT } from '../../constants';

interface UpgradeBlockProps {
  onNavigateToWhatsNew?: () => void;
}

export const UpgradeBlock: FC<UpgradeBlockProps> = ({ onNavigateToWhatsNew }) => {
  const api = useStorybookApi();
  const [activeTab, setActiveTab] = useState<'npm' | 'yarn' | 'pnpm'>('npm');

  return (
    <Container>
      <strong>You are on Storybook {api.getCurrentVersion().version}</strong>
      <p>Run the following script to check for updates and upgrade to the latest version.</p>
      <Tabs>
        <ButtonTab active={activeTab === 'npm'} onClick={() => setActiveTab('npm')}>
          npm
        </ButtonTab>
        <ButtonTab active={activeTab === 'yarn'} onClick={() => setActiveTab('yarn')}>
          yarn
        </ButtonTab>
        <ButtonTab active={activeTab === 'pnpm'} onClick={() => setActiveTab('pnpm')}>
          pnpm
        </ButtonTab>
      </Tabs>
      <Code>
        {activeTab === 'npm'
          ? 'npx storybook@latest upgrade'
          : `${activeTab} dlx storybook@latest upgrade`}
      </Code>
      {onNavigateToWhatsNew && (
        <Link onClick={onNavigateToWhatsNew}>See what's new in Storybook</Link>
      )}
    </Container>
  );
};

const Container = styled.div({
  border: '1px solid',
  borderRadius: 5,
  padding: 20,
  marginTop: 0,
  borderColor: 'var(--sb-appBorderColor)',
  fontSize: `var(--sb-typography-size-s2)`,
  width: '100%',

  [MEDIA_DESKTOP_BREAKPOINT]: {
    maxWidth: 400,
  },
});

const Tabs = styled.div({
  display: 'flex',
  gap: 2,
});

const Code = styled.pre(({ theme }) => ({
  background: theme.base === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'var(--sb-appBorderColor)',
  fontSize: `calc(var(--sb-typography-size-s2) - 1px)`,
  margin: '4px 0 16px',
}));

const ButtonTab = styled.button<{ active: boolean }>(({ active }) => ({
  all: 'unset',
  alignItems: 'center',
  gap: 10,
  color: 'var(--sb-color-defaultText)',
  fontSize: `calc(var(--sb-typography-size-s2) - 1px)`,
  borderBottom: '2px solid transparent',
  borderBottomColor: active ? 'var(--sb-color-secondary)' : 'transparent',
  padding: '0 10px 5px',
  marginBottom: '5px',
  cursor: 'pointer',
}));
