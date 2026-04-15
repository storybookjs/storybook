import React from 'react';

import { internal_checklistStore as checklistStore } from '#manager-stores';
import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';
import { styled } from 'storybook/theming';

import preview from '../../../../../.storybook/preview.tsx';
import { checklistData } from '../../../shared/checklist-store/checklistData.tsx';
import type { ChecklistItem } from '../../components/sidebar/useChecklist.ts';
import { Checklist } from './Checklist.tsx';

const buildItems = (values: Record<string, 'accepted' | 'done' | 'skipped'>) =>
  checklistData.sections.flatMap(({ id: sectionId, title: sectionTitle, items }, sectionIndex) =>
    items.map<ChecklistItem>((item, itemIndex) => {
      const itemValue = values[item.id];
      const isAccepted = itemValue === 'accepted';
      const isDone = itemValue === 'done';
      const isSkipped = itemValue === 'skipped';
      const isOpen = !isAccepted && !isDone && !isSkipped;
      return {
        ...item,
        itemIndex,
        sectionId,
        sectionIndex,
        sectionTitle,
        isAvailable: true,
        isLockedBy: undefined,
        isImmutable: false,
        isCompleted: isAccepted || isDone,
        isReady: true,
        isOpen,
        isAccepted,
        isDone,
        isSkipped,
        isMuted: false,
      };
    })
  );

const availableItems = buildItems({
  controls: 'accepted',
  renderComponent: 'done',
  whatsNewStorybook10: 'done',
  viewports: 'skipped',
});

const Container = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2,
}));

const managerContext: any = {
  state: {},
  api: {
    getDocsUrl: fn(
      ({ asset, subpath }) =>
        // TODO: Remove hard-coded version. Should be `major.minor` of latest release.
        `https://storybook.js.org/${asset ? 'docs-assets/10.0' : 'docs'}/${subpath}`
    ).mockName('api::getDocsUrl'),
    getData: fn().mockName('api::getData'),
    getIndex: fn().mockName('api::getIndex'),
    getUrlState: fn().mockName('api::getUrlState'),
    navigate: fn().mockName('api::navigate'),
    on: fn().mockName('api::on'),
    off: fn().mockName('api::off'),
    once: fn().mockName('api::once'),
  },
};

const meta = preview.meta({
  component: Checklist,
  decorators: [
    (Story) => (
      <ManagerContext.Provider value={managerContext}>
        <Container>
          <Story />
        </Container>
      </ManagerContext.Provider>
    ),
  ],
});

export const Default = meta.story({
  args: { availableItems, ...checklistStore },
});

export const WithAiSetup = meta.story({
  args: {
    availableItems: buildItems({
      controls: 'accepted',
      renderComponent: 'done',
      whatsNewStorybook10: 'done',
      viewports: 'skipped',
      // aiSetup is intentionally omitted → status 'open'
    }),
    ...checklistStore,
  },
});

export const WithAiSetupSkipped = meta.story({
  args: {
    availableItems: buildItems({
      controls: 'accepted',
      renderComponent: 'done',
      whatsNewStorybook10: 'done',
      viewports: 'skipped',
      aiSetup: 'skipped',
    }),
    ...checklistStore,
  },
});
