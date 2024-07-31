import ReactDOM from 'react-dom';
import React, { lazy, Suspense } from 'react';
import { addons } from 'storybook/internal/manager-api';
import { STORY_SPECIFIED } from 'storybook/internal/core-events';

const Onboarding = lazy(() => import('./Onboarding'));

// The addon is enabled only when:
// 1. The onboarding query parameter is present
// 2. The example button stories are present
addons.register('@storybook/addon-onboarding', async (api) => {
  const urlState = api.getUrlState();
  const isOnboarding =
    urlState.path === '/onboarding' || urlState.queryParams.onboarding === 'true';

  api.once(STORY_SPECIFIED, () => {
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
    api.setSelectedPanel('addon-controls');

    // Add a new DOM element to document.body, where we will bootstrap our React app
    const domNode = document.createElement('div');

    domNode.id = 'storybook-addon-onboarding';
    // Append the new DOM element to document.body
    document.body.appendChild(domNode);

    // Render the React app
    // eslint-disable-next-line react/no-deprecated
    ReactDOM.render(
      <Suspense fallback={<div />}>
        <Onboarding api={api} />
      </Suspense>,
      domNode
    );
  });
});
