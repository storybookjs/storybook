import React from 'react';

import { ManagerContext } from 'storybook/manager-api';
import { fn } from 'storybook/test';

import preview from '../../../../../.storybook/preview.tsx';
import { checklistData } from '../../../shared/checklist-store/checklistData.tsx';
import type { ChecklistItem } from '../../components/sidebar/useChecklist.ts';
import { AiSetupBlock } from './AiSetupBlock.tsx';

const managerContext: any = {
  state: {},
  api: {
    getDocsUrl: fn().mockName('api::getDocsUrl'),
    getData: fn().mockName('api::getData'),
    getIndex: fn().mockName('api::getIndex'),
    getUrlState: fn().mockName('api::getUrlState'),
    navigate: fn().mockName('api::navigate'),
    on: fn().mockName('api::on'),
    off: fn().mockName('api::off'),
    once: fn().mockName('api::once'),
    emit: fn().mockName('api::emit'),
  },
};

// Get the raw aiPrepare item. Cast through unknown to avoid deep discriminated-union issues
// with the as-const typed checklistData — the shape is correct at runtime.
const rawAiPrepareItem = checklistData.sections
  .flatMap((s) => s.items as unknown as ChecklistItem[])
  .find((item) => item.id === 'aiPrepare')!;

const makeItem = (overrides: Partial<ChecklistItem> = {}): ChecklistItem => ({
  ...rawAiPrepareItem,
  itemIndex: 0,
  sectionId: 'basics',
  sectionIndex: 0,
  sectionTitle: 'Storybook basics',
  isAvailable: true,
  isLockedBy: undefined,
  isImmutable: false,
  isCompleted: false,
  isReady: true,
  isOpen: true,
  isAccepted: false,
  isDone: false,
  isSkipped: false,
  isMuted: false,
  ...overrides,
});

const meta = preview.meta({
  component: AiSetupBlock,
  decorators: [
    (Story) => (
      <ManagerContext.Provider value={managerContext}>
        <div style={{ maxWidth: 600, padding: 20 }}>
          <Story />
        </div>
      </ManagerContext.Provider>
    ),
  ],
});

export const Open = meta.story({
  args: {
    item: makeItem(),
    reset: fn().mockName('reset'),
    skip: fn().mockName('skip'),
  },
});

export const Skipped = meta.story({
  args: {
    item: makeItem({ isSkipped: true, isOpen: false }),
    reset: fn().mockName('reset'),
    skip: fn().mockName('skip'),
  },
});

// Shows the block starting in the Skipped (collapsed) state.
// Toggle between this story and Open to see the animation.
export const SkippedToOpen = meta.story({
  args: {
    item: makeItem({ isSkipped: true, isOpen: false }),
    reset: fn().mockName('reset'),
    skip: fn().mockName('skip'),
  },
});
