import React from 'react';

import { Button, Link } from 'storybook/internal/components';

import { global } from '@storybook/global';

import { styled } from 'storybook/theming';

import {
  AI_CTA_BODY,
  AI_CTA_COPY_BUTTON_LABEL,
  AI_CTA_HEADING,
  AI_CTA_SKIP_BUTTON_LABEL,
  AI_PREPARE_PROMPT,
} from '../../shared/checklist-store/prompts.ts';
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
  flexDirection: 'column',
  gap: 12,
  padding: 20,
  border: `1px solid ${theme.base === 'dark' ? theme.color.darker : theme.color.border}`,
  borderRadius: 8,
  background: theme.background.content,
}));

const AiCtaHeading = styled.h2(({ theme }) => ({
  margin: 0,
  fontSize: theme.typography.size.s3,
  fontWeight: theme.typography.weight.bold,
}));

const AiCtaBody = styled.p({
  margin: 0,
  lineHeight: 1.4,
});

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
          <AiCtaHeading>{AI_CTA_HEADING}</AiCtaHeading>
          <AiCtaBody>{AI_CTA_BODY}</AiCtaBody>
          <AiCtaActions>
            <Button variant="ghost" size="small" onClick={() => checklist.skip('aiPrepare')}>
              {AI_CTA_SKIP_BUTTON_LABEL}
            </Button>
            <Button
              variant="solid"
              size="small"
              onClick={() => {
                // eslint-disable-next-line compat/compat
                navigator.clipboard?.writeText(AI_PREPARE_PROMPT);
              }}
            >
              {AI_CTA_COPY_BUTTON_LABEL}
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
