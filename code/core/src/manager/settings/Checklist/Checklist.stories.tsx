import React from 'react';

import { internal_checklistStore as checklistStore } from '#manager-stores';
import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';
import { styled } from 'storybook/theming';

import preview from '../../../../../.storybook/preview';
import type { ChecklistItem } from '../../components/sidebar/useChecklist';
import { Checklist } from './Checklist';
import { checklistData } from './checklistData';

const accepted = ['controls'];
const done = ['render-component', 'whats-new-storybook-10'];
const skipped = ['viewports'];

const availableItems = checklistData.sections.flatMap(
  ({ id: sectionId, title: sectionTitle, items }, sectionIndex) =>
    items.map<ChecklistItem>((item, itemIndex) => ({
      ...item,
      itemIndex,
      sectionId,
      sectionIndex,
      sectionTitle,
      isAvailable: true,
      isOpen: !accepted.includes(item.id) && !done.includes(item.id) && !skipped.includes(item.id),
      isLockedBy: [],
      isImmutable: false,
      isCompleted: accepted.includes(item.id) || done.includes(item.id),
      isReady: true,
      isAccepted: accepted.includes(item.id),
      isDone: done.includes(item.id),
      isSkipped: skipped.includes(item.id),
      isMuted: false,
    }))
);

const Container = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2,
}));

const managerContext: any = {
  state: {},
  api: {
    getDocsUrl: fn(({ subpath }) => `https://storybook.js.org/docs/${subpath}`).mockName(
      'api::getDocsUrl'
    ),
    getData: fn().mockName('api::getData'),
    getIndex: fn().mockName('api::getIndex'),
    getUrlState: fn().mockName('api::getUrlState'),
    navigate: fn().mockName('api::navigate'),
    on: fn().mockName('api::on'),
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
