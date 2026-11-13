import React, { type SyntheticEvent, useCallback, useMemo, useRef, useState } from 'react';

import { ActionList, Card } from 'storybook/internal/components';
import type { StatusesByStoryIdAndTypeId, StatusValue, StoryIndex } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { CheckIcon, CloseAltIcon, CopyIcon, WandIcon } from '@storybook/icons';

import {
  experimental_useStatusStore,
  useStorybookApi,
  useStorybookState,
} from 'storybook/manager-api';
import { styled } from 'storybook/theming/emotion';

import { useCopyButton } from '../../../shared/useCopyButton.ts';
import { useLandmark } from '../../hooks/useLandmark.ts';
import { useActiveReviewStoryCount } from './ReviewWidget.tsx';

/**
 * The prompt the user copies into their agent. It names the skill in plain language so it works
 * both with the project skill (`ui-review`) and with the plugin skill (`storybook:ui-review`):
 * agents match a skill by its name and description, not by the namespace prefix.
 */
export const REVIEW_HINT_PROMPT =
  'Use the ui-review skill to publish a Storybook review of the stories that changed.';

export const REVIEW_HINT_DISMISSED_KEY = 'storybook/review-hint/dismissed';

const HEADING_ID = 'storybook-review-hint-heading';

const NEW = 'status-value:new' as StatusValue;
const MOD = 'status-value:modified' as StatusValue;

// `localStorage` can throw (privacy modes, disabled storage, sandboxed iframes). The hint then
// stays dismissed for the current page only.
const dismissedStore = {
  read(): boolean {
    try {
      return globalThis.localStorage?.getItem(REVIEW_HINT_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  },
  write(): void {
    try {
      globalThis.localStorage?.setItem(REVIEW_HINT_DISMISSED_KEY, 'true');
    } catch {
      // Storage unavailable: keep the in-memory state only.
    }
  },
};

/** Number of stories in the index that change detection marks as new or modified. */
export const useChangedStoryCount = () => {
  const { internal_index: index } = useStorybookState();
  const allStatuses = experimental_useStatusStore() as StatusesByStoryIdAndTypeId;

  return useMemo(() => {
    const entries = (index as StoryIndex | undefined)?.entries ?? {};
    let count = 0;
    for (const [storyId, statusesByType] of Object.entries(allStatuses)) {
      if (!entries[storyId]) {
        continue;
      }
      if (Object.values(statusesByType).some(({ value }) => value === NEW || value === MOD)) {
        count += 1;
      }
    }
    return count;
  }, [index, allStatuses]);
};

// Landmark wrapper, like the review widget's, so the hint is reachable with F6.
const Region = styled.section({
  width: '100%',
});

const HeaderContent = styled(ActionList.Text)({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'flex-start',
  alignItems: 'center',
  gap: 6,
  // Room for the dismiss button in the top-right corner.
  paddingRight: 24,
});

const HeaderTitle = styled.h2(({ theme }) => ({
  margin: 0,
  color: theme.color.defaultText,
  fontWeight: theme.typography.weight.bold,
  fontSize: theme.typography.size.s1,
  lineHeight: `${theme.typography.size.s3}px`,
}));

const AgenticIcon = styled(WandIcon)(({ theme }) => ({
  color: theme.fgColor.agentic,
}));

const Prompt = styled.small({
  // The prompt is the payload; show it in full so users know what they paste.
  whiteSpace: 'normal',
});

const CopyAction = styled(ActionList.Action)({
  justifyContent: 'flex-start',
});

const DismissButton = styled(ActionList.Button)({
  position: 'absolute',
  top: 4,
  right: 4,
  zIndex: 1,
});

const DismissIcon = styled(CloseAltIcon)({
  padding: 1,
});

export interface ReviewHintViewProps {
  onDismiss: (event: SyntheticEvent) => void;
}

/**
 * Tells the user that they can ask their agent for a review of the changed stories, with a prompt
 * to copy. Storybook cannot call the agent itself.
 */
export const ReviewHintView = ({ onDismiss }: ReviewHintViewProps) => {
  const regionRef = useRef<HTMLElement>(null);
  const { landmarkProps } = useLandmark(
    { role: 'region', 'aria-labelledby': HEADING_ID },
    regionRef
  );

  const { children: copyChildren, buttonProps: copyButtonProps } = useCopyButton<React.ReactNode>({
    content: REVIEW_HINT_PROMPT,
    children: (
      <>
        <CopyIcon />
        <ActionList.Text>
          <strong>Copy prompt</strong>
          <Prompt>{REVIEW_HINT_PROMPT}</Prompt>
        </ActionList.Text>
      </>
    ),
    childrenOnCopy: (
      <>
        <CheckIcon />
        <ActionList.Text>
          <strong>Copied</strong>
          <Prompt>Paste it in your agent's chat.</Prompt>
        </ActionList.Text>
      </>
    ),
    ariaLabel: 'Copy review prompt for your agent',
    ariaLabelOnCopy: 'Review prompt copied. Paste it in your agent.',
  });

  return (
    <Region ref={regionRef} {...landmarkProps}>
      <Card color="agentic" id="storybook-review-hint">
        <ActionList as="div">
          <ActionList.Item as="div">
            <HeaderContent>
              <AgenticIcon aria-hidden />
              <HeaderTitle id={HEADING_ID}>Ask your agent for a review</HeaderTitle>
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

/**
 * Shows the review hint in the spot of the review widget while there are changed stories, no
 * active review, and the user has not dismissed it. Only on a dev server: a static build cannot
 * receive a review.
 */
export const ReviewHint = () => {
  const api = useStorybookApi();
  const changedStoryCount = useChangedStoryCount();
  const activeReviewStoryCount = useActiveReviewStoryCount();
  const [dismissed, setDismissed] = useState(dismissedStore.read);

  const onDismiss = useCallback((event: SyntheticEvent) => {
    event.stopPropagation();
    dismissedStore.write();
    setDismissed(true);
  }, []);

  if (
    dismissed ||
    global.CONFIG_TYPE !== 'DEVELOPMENT' ||
    activeReviewStoryCount > 0 ||
    changedStoryCount === 0 ||
    !api.getIsNavShown()
  ) {
    return null;
  }

  return <ReviewHintView onDismiss={onDismiss} />;
};

export default ReviewHint;
