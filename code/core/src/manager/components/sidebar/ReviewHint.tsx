import React, { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { ActionList, Card } from 'storybook/internal/components';
import { AI_PROMPT_NUDGE } from 'storybook/internal/core-events';
import type { StatusesByStoryIdAndTypeId, StatusValue, StoryIndex } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { CheckIcon, CopyIcon } from '@storybook/icons';

import {
  experimental_useStatusStore,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';
import { styled } from 'storybook/theming/emotion';

import { focusableUIElements } from '../../../manager-api/modules/layout.ts';
import { useCopyButton } from '../../../shared/useCopyButton.ts';
import { UI_REVIEW_PROMPT } from '../../../shared/utils/ai-prompts.ts';
import { useLandmark } from '../../hooks/useLandmark.ts';
// The review widget takes this spot once a review is active; the hint uses its parts.
import {
  AgenticIcon,
  DismissButton,
  DismissIcon,
  HeaderContent,
  HeaderTitle,
  Region,
  useActiveReviewStoryCount,
} from './ReviewWidget.tsx';
import { useChecklist } from './useChecklist.ts';

export const REVIEW_HINT_DISMISSED_KEY = 'storybook/review-hint/dismissed';

const HEADING_ID = 'storybook-review-hint-heading';

const NEW = 'status-value:new' as StatusValue;
const MOD = 'status-value:modified' as StatusValue;

// Whether change detection marks a story of the index as new or modified.
const useHasChangedStories = () => {
  const { internal_index: index } = useStorybookState();
  const allStatuses = experimental_useStatusStore() as StatusesByStoryIdAndTypeId;

  return useMemo(() => {
    const entries = (index as StoryIndex | undefined)?.entries ?? {};
    return Object.entries(allStatuses).some(
      ([storyId, statusesByType]) =>
        entries[storyId] &&
        Object.values(statusesByType).some(({ value }) => value === NEW || value === MOD)
    );
  }, [index, allStatuses]);
};

const CopyAction = styled(ActionList.Action)({
  justifyContent: 'flex-start',
});

// Tells the user that they can ask their agent for a review of the changed stories, with a prompt
// to copy. Storybook cannot call the agent itself.
const ReviewHintCard = ({ onDismiss }: { onDismiss: () => void }) => {
  const api = useStorybookApi();
  const regionRef = useRef<HTMLElement>(null);
  const { landmarkProps } = useLandmark(
    { role: 'region', 'aria-labelledby': HEADING_ID },
    regionRef
  );

  // No aria-label: the accessible name is the visible text, prompt included, so screen reader
  // users hear what they copy. The hook announces "Copied to clipboard" after a copy.
  const { children: copyChildren, buttonProps: copyButtonProps } = useCopyButton<ReactNode>({
    content: UI_REVIEW_PROMPT,
    children: (
      <>
        <CopyIcon />
        <ActionList.Text>
          <strong>Copy prompt</strong>
          <small>{UI_REVIEW_PROMPT}</small>
        </ActionList.Text>
      </>
    ),
    childrenOnCopy: (
      <>
        <CheckIcon />
        <ActionList.Text>
          <strong>Copied</strong>
          <small>Paste it in your agent's chat.</small>
        </ActionList.Text>
      </>
    ),
    onCopy: () => {
      api.emit(AI_PROMPT_NUDGE, {
        id: 'ui-review',
        origin: 'sidebar-review-hint',
      });
    },
  });

  return (
    <Region ref={regionRef} {...landmarkProps}>
      <Card color="agentic" id="storybook-review-hint">
        <ActionList as="div">
          <ActionList.Item as="div">
            <HeaderContent>
              <AgenticIcon aria-hidden />
              <HeaderTitle id={HEADING_ID}>Ask your agent for a UI review</HeaderTitle>
            </HeaderContent>
          </ActionList.Item>
        </ActionList>
        <ActionList as="div">
          <ActionList.Item as="div">
            <CopyAction {...copyButtonProps} disableAllTooltips appearance="agentic">
              {copyChildren}
            </CopyAction>
          </ActionList.Item>
        </ActionList>
        <DismissButton appearance="agentic" ariaLabel="Dismiss review hint" onClick={onDismiss}>
          <DismissIcon />
        </DismissButton>
      </Card>
    </Region>
  );
};

// Remembered per origin. `localStorage` can throw (privacy modes, disabled storage); the hint then
// stays dismissed for this page only.
const readDismissed = () => {
  try {
    return localStorage.getItem(REVIEW_HINT_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
};

const writeDismissed = () => {
  try {
    localStorage.setItem(REVIEW_HINT_DISMISSED_KEY, 'true');
  } catch {
    // Storage unavailable: keep the in-memory state only.
  }
};

// Shows the review hint in the spot of the review widget while:
// - the project has Storybook's skills, so the prompt works (`hasSkills`, set by the server);
// - stories changed and no review is active;
// - the onboarding checklist does not show its own "Set up with AI" prompt, so a first run after
//   `storybook init` does not show two prompt cards under each other;
// - the user has not dismissed it or had a review, and Storybook runs as a dev server.
export const ReviewHint = () => {
  const api = useStorybookApi();
  const { loaded, hasSkills, nextItems } = useChecklist();
  const hasChangedStories = useHasChangedStories();
  const activeReviewStoryCount = useActiveReviewStoryCount();
  const [dismissed, setDismissed] = useState(readDismissed);

  const dismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  // A user who has had a review knows that they can ask for one.
  useEffect(() => {
    if (activeReviewStoryCount > 0) {
      writeDismissed();
      setDismissed(true);
    }
  }, [activeReviewStoryCount]);

  const onDismiss = () => {
    dismiss();
    // The card unmounts; keep keyboard focus in the sidebar.
    api.focusOnUIElement(focusableUIElements.storySearchField);
  };

  const checklistShowsAiSetup =
    global.FEATURES?.sidebarOnboardingChecklist !== false &&
    nextItems.some((item) => item.id === 'aiSetup');

  if (
    !loaded ||
    !hasSkills ||
    dismissed ||
    checklistShowsAiSetup ||
    global.CONFIG_TYPE !== 'DEVELOPMENT' ||
    activeReviewStoryCount > 0 ||
    !hasChangedStories ||
    !api.getIsNavShown()
  ) {
    return null;
  }

  return <ReviewHintCard onDismiss={onDismiss} />;
};
