import { addons } from 'storybook/internal/manager-api';

import type { API_StatusUpdate, API_StatusValue, StoryId } from '@storybook/types';

import { ADDON_ID } from './constants';
import type { AssertionResult, TestReport } from './types';
import { SharedState } from './utils/shared-state';

const statusMap: Record<AssertionResult['status'], API_StatusValue> = {
  failed: 'error',
  passed: 'success',
  pending: 'pending',
};

function processTestReport(report: TestReport, onClick: any) {
  const result: API_StatusUpdate = {};

  report.testResults.forEach((testResult) => {
    testResult.assertionResults.forEach((assertion) => {
      const storyId = assertion.meta?.storyId;
      if (storyId) {
        result[storyId] = {
          title: 'Vitest',
          status: statusMap[assertion.status],
          description:
            assertion.failureMessages.length > 0 ? assertion.failureMessages.join('\n') : '',
          onClick,
        };
      }
    });
  });

  return result;
}

addons.register(ADDON_ID, (api) => {
  const channel = api.getChannel();

  if (!channel) {
    return;
  }

  const testResultsState = SharedState.subscribe<TestReport>('TEST_RESULTS', channel);
  const lastStoryIds = new Set<StoryId>();

  testResultsState.on('change', async (report) => {
    if (!report) {
      return;
    }

    const storiesToClear = Object.fromEntries(Array.from(lastStoryIds).map((id) => [id, null]));

    if (Object.keys(storiesToClear).length > 0) {
      // Clear old statuses to avoid stale data
      await api.experimental_updateStatus(ADDON_ID, storiesToClear);
      lastStoryIds.clear();
    }

    const openInteractionsPanel = () => {
      api.setSelectedPanel('storybook/interactions/panel');
      api.togglePanel(true);
    };

    const final = processTestReport(report, openInteractionsPanel);

    await api.experimental_updateStatus(ADDON_ID, final);
  });
});
