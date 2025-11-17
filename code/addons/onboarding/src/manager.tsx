import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';

import { STORY_SPECIFIED } from 'storybook/internal/core-events';

import { addons, internal_universalChecklistStore as checklistStore } from 'storybook/manager-api';

import { ADDON_CONTROLS_ID, ADDON_ID } from './constants';

const Onboarding = lazy(() => import('./Onboarding'));
const Survey = lazy(() => import('./Survey'));

let root: ReturnType<typeof createRoot> | null = null;
const render = (node: React.ReactNode) => {
  let container = document.getElementById('storybook-addon-onboarding');
  if (!container) {
    container = document.createElement('div');
    container.id = 'storybook-addon-onboarding';
    document.body.appendChild(container);
  }
  root = root ?? createRoot(container);
  root.render(<Suspense fallback={<div />}>{node}</Suspense>);
};

// The addon is enabled only when:
// 1. The onboarding query parameter is present
// 2. The example button stories are present
addons.register(ADDON_ID, async (api) => {
  const { path, queryParams } = api.getUrlState();
  const isOnboarding = path === '/onboarding' || queryParams.onboarding === 'true';
  const isSurvey = queryParams.onboarding === 'survey';

  const hasCompletedSurvey = await new Promise<boolean>((resolve) => {
    const unsubscribe = checklistStore.onStateChange(({ loaded, accepted }) => {
      if (loaded) {
        unsubscribe();
        resolve(accepted.includes('onboarding-survey'));
      }
    });
  });

  if (isSurvey) {
    return hasCompletedSurvey ? null : render(<Survey api={api} />);
  }

  await new Promise((resolve) => api.once(STORY_SPECIFIED, resolve));

  const hasButtonStories =
    !!api.getData('example-button--primary') ||
    !!document.getElementById('example-button--primary');

  if (!hasButtonStories) {
    console.warn(
      `[@storybook/addon-onboarding] It seems like you have finished the onboarding experience in Storybook! Therefore this addon is not necessary anymore and will not be loaded. You are free to remove it from your project. More info: https://github.com/storybookjs/storybook/tree/next/code/addons/onboarding#uninstalling`
    );
    return;
  }

  if (!isOnboarding || window.innerWidth < 730) {
    return;
  }

  api.togglePanel(true);
  api.togglePanelPosition('bottom');
  api.setSelectedPanel(ADDON_CONTROLS_ID);

  return render(<Onboarding api={api} hasCompletedSurvey={hasCompletedSurvey} />);
});
