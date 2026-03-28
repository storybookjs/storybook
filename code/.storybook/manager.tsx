import { startCase } from 'es-toolkit/string';
import { type API, addons, experimental_getStatusStore } from 'storybook/manager-api';

addons.setConfig({
  sidebar: {
    renderLabel: ({ name, type }) => (type === 'story' ? name : startCase(name)),
  },
});

console.log('yeha');

// --- DEV ONLY: Randomly assign statuses to sidebar stories for testing ---
function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function applyRandomStatuses(api: API) {
  const changeDetectionStore = experimental_getStatusStore('storybook/change-detection');
  const vitestStore = experimental_getStatusStore('storybook/vitest');

  console.log({ changeDetectionStore });

  // Get all story entries from the internal index
  const index = api.getIndex();
  if (!index) {
    console.warn('[status-dev] Index not available yet');
    return;
  }
  const storyIds = Object.values(index.entries)
    .filter((entry) => entry.type === 'story')
    .map((entry) => entry.id);

  if (storyIds.length === 0) {
    console.warn('[status-dev] No stories found in index');
    return;
  }

  // Pick ~30% of stories for change-detection statuses
  const changeDetectionStatuses = storyIds
    .filter(() => Math.random() < 0.4)
    .map((storyId) => ({
      storyId,
      typeId: 'storybook/change-detection' as const,
      value: pickRandom([
        'status-value:new',
        'status-value:modified',
        'status-value:affected',
      ] as const) as any,
      sidebarContextMenu: false,
    }));

  // Pick ~25% of stories for vitest statuses
  const vitestStatuses = storyIds
    .filter(() => Math.random() < 0.4)
    .map((storyId) => ({
      storyId,
      typeId: 'storybook/vitest' as const,
      value: pickRandom([
        'status-value:success',
        'status-value:error',
        'status-value:warning',
      ] as const) as any,
      title: 'Vitest',
      description: 'Randomly generated test status for dev testing',
    }));

  if (changeDetectionStatuses.length > 0) {
    changeDetectionStore.set(changeDetectionStatuses);
    console.log(
      `[status-dev] Set change-detection statuses on ${changeDetectionStatuses.length} stories`
    );
  }
  if (vitestStatuses.length > 0) {
    vitestStore.set(vitestStatuses);
    console.log(`[status-dev] Set vitest statuses on ${vitestStatuses.length} stories`);
  }
}

addons.register('dev-status-addon', (api) => {
  console.log('es geht los');
  setTimeout(() => applyRandomStatuses(api), 2000);
});
