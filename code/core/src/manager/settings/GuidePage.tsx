import React from 'react';

import { Button, Link } from 'storybook/internal/components';

import { global } from '@storybook/global';

import { styled } from 'storybook/theming';

import { AI_PREPARE_PROMPT } from '../../shared/constants/ai-prompts.ts';
import { useChecklist } from '../components/sidebar/useChecklist.ts';
import { Checklist } from './Checklist/Checklist.tsx';

const Container = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  maxWidth: 600,
  margin: '0 auto',
  padding: '48px 20px',
  gap: 32,
  fontSize: theme.typography.size.s2,
  '--transition-duration': '0.2s',
}));

const Intro = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,

  '& h1': {
    fontSize: theme.typography.size.m3,
    fontWeight: theme.typography.weight.bold,
    margin: 0,
  },

  '& > p': {
    margin: 0,
  },
}));

const AiCtaCard = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  padding: 15,
  border: `1px solid ${theme.base === 'dark' ? theme.color.darker : theme.color.border}`,
  borderRadius: 8,
  background: theme.background.content,
}));

const AiCtaHeading = styled.h2(({ theme }) => ({
  margin: 0,
  fontSize: theme.typography.size.s2,
  fontWeight: theme.typography.weight.regular,
  textWrap: 'pretty',
}));

const AiCtaActions = styled.div({
  display: 'flex',
  gap: 8,
});

export const GuidePage = () => {
  const checklist = useChecklist();

  const aiPrepareItem = checklist.availableItems.find((item) => item.id === 'aiPrepare');
  const showAiCta = aiPrepareItem?.isOpen ?? false;

  return (
    <Container>
      <Intro>
        <h1>Guide</h1>
        <p>
          Whether you&apos;re just getting started or looking for ways to level up, this checklist
          will help you make the most of your Storybook.
        </p>
      </Intro>
      {showAiCta && (
        <AiCtaCard>
          <AiCtaHeading>Want to have your AI agent set up Storybook automatically?</AiCtaHeading>
          <AiCtaActions>
            <Button
              variant="ghost"
              size="medium"
              ariaLabel={false}
              onClick={() => checklist.skip('aiPrepare')}
            >
              Skip
            </Button>
            <Button
              variant="solid"
              size="medium"
              ariaLabel={false}
              onClick={() => {
                // eslint-disable-next-line compat/compat
                navigator.clipboard?.writeText(AI_PREPARE_PROMPT);
              }}
            >
              Copy prompt
            </Button>
          </AiCtaActions>
        </AiCtaCard>
      )}
      <Checklist {...checklist} forceCollapsed={showAiCta} />
      {global.FEATURES?.sidebarOnboardingChecklist !== false && (
        <>
          {checklist.openItems.length === 0 ? (
            <center>Your work here is done!</center>
          ) : checklist.widget.disable || checklist.openItems.every((item) => item.isMuted) ? (
            <center>
              Want to see this in the sidebar?{' '}
              <Link onClick={() => checklist.disable(false)}>Show in sidebar</Link>
            </center>
          ) : (
            <center>
              Don&apos;t want to see this in the sidebar?{' '}
              <Link onClick={() => checklist.mute(checklist.allItems.map(({ id }) => id))}>
                Remove from sidebar
              </Link>
            </center>
          )}
        </>
      )}
    </Container>
  );
};
