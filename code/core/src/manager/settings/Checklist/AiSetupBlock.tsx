import React, { type ReactNode } from 'react';

import { Button, Collapsible } from 'storybook/internal/components';
import { AI_PROMPT_NUDGE } from 'storybook/internal/core-events';

import { CheckIcon, UndoIcon } from '@storybook/icons';

import { type API, useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { AI_SETUP_PROMPT } from '../../../shared/constants/ai-prompts.ts';
import { useCopyButton } from '../../../shared/useCopyButton.ts';
import type { ItemId } from '../../../shared/checklist-store/index.ts';
import type { ChecklistItem } from '../../components/sidebar/useChecklist.ts';
import { Skipped, StatusIcon } from './Checklist.tsx';

const AiCtaCard = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  padding: '10px 10px 10px 15px',
  border: `1px solid ${theme.base === 'dark' ? theme.color.darker : theme.color.border}`,
  borderRadius: 8,
  background: theme.background.content,
}));

const AiCtaHeadingRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
});

const AiCtaHeading = styled.h2<{ $skipped: boolean }>(({ theme, $skipped }) => ({
  flex: 1,
  margin: 0,
  color: $skipped ? theme.textMutedColor : theme.color.defaultText,
  fontSize: theme.typography.size.s2,
  fontWeight: theme.typography.weight.bold,
  textWrap: 'pretty',
}));

const AiCtaDescription = styled.p(({ theme }) => ({
  margin: 0,
  color: theme.color.defaultText,
  fontSize: theme.typography.size.s2,
  fontWeight: theme.typography.weight.regular,
  marginTop: 8,
}));

const AiCtaActions = styled.div({
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  marginTop: 12,
});

const CopyButton = ({ api }: { api: API }) => {
  const { children: buttonChildren, buttonProps } = useCopyButton<ReactNode>({
    children: 'Copy prompt',
    childrenOnCopy: (
      <>
        <CheckIcon /> Copied!
      </>
    ),
    content: AI_SETUP_PROMPT,
    onCopy: () => {
      api.emit(AI_PROMPT_NUDGE, { id: 'prepare', origin: 'onboarding-guide-page' });
    },
  });

  return (
    <Button variant="solid" size="medium" {...buttonProps}>
      {buttonChildren}
    </Button>
  );
};

export const AiSetupBlock = ({
  item,
  reset,
  skip,
}: {
  item: ChecklistItem;
  reset: (id: ItemId) => void;
  skip: (id: ItemId) => void;
}) => {
  const api = useStorybookApi();

  const showAiCta = !item.isDone && !item.isAccepted && !item.isCompleted;

  if (!showAiCta) {
    return null;
  }

  return (
    <AiCtaCard>
      <AiCtaHeadingRow>
        {item.isSkipped && (
          <StatusIcon>
            <Skipped visible>Skipped</Skipped>
          </StatusIcon>
        )}
        <AiCtaHeading $skipped={item.isSkipped}>Set up Storybook with AI</AiCtaHeading>
        {item.isSkipped && (
          <Button ariaLabel="Undo" variant="ghost" padding="small" onClick={() => reset(item.id)}>
            <UndoIcon />
          </Button>
        )}
      </AiCtaHeadingRow>

      <Collapsible.Content collapsed={item.isSkipped}>
        <AiCtaDescription>
          Run a prompt in your AI agent to analyze your codebase, configure decorators and mocks,
          write sample stories for your UI components, and verify everything works.
        </AiCtaDescription>
        <AiCtaActions>
          <Button variant="ghost" size="medium" ariaLabel={false} onClick={() => skip(item.id)}>
            Skip
          </Button>
          <CopyButton api={api} />
        </AiCtaActions>
      </Collapsible.Content>
    </AiCtaCard>
  );
};
