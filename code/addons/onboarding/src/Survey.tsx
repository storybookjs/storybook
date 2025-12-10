import React, { useCallback, useEffect } from 'react';

import { type API } from 'storybook/manager-api';
import { ThemeProvider, convert } from 'storybook/theming';

import { ADDON_ONBOARDING_CHANNEL } from './constants';
import { IntentSurvey } from './features/IntentSurvey/IntentSurvey';

const theme = convert();

export default function Survey({ api }: { api: API }) {
  // eslint-disable-next-line compat/compat
  const userAgent = globalThis?.navigator?.userAgent;

  useEffect(() => {
    api.emit(ADDON_ONBOARDING_CHANNEL, {
      from: 'guide',
      type: 'openSurvey',
      userAgent,
    });
  }, [api, userAgent]);

  const disableOnboarding = useCallback(() => {
    // remove onboarding query parameter from current url
    const url = new URL(window.location.href);
    url.searchParams.set('onboarding', 'false');
    history.replaceState({}, '', url.href);
    api.setQueryParams({ onboarding: 'false' });
  }, [api]);

  const complete = useCallback(
    (answers: Record<string, unknown>) => {
      api.emit(ADDON_ONBOARDING_CHANNEL, {
        answers,
        type: 'survey',
        userAgent,
      });
      disableOnboarding();
    },
    [api, disableOnboarding, userAgent]
  );

  const dismiss = useCallback(() => {
    api.emit(ADDON_ONBOARDING_CHANNEL, {
      type: 'dismissSurvey',
    });
    disableOnboarding();
  }, [api, disableOnboarding]);

  return (
    <ThemeProvider theme={theme}>
      <IntentSurvey onComplete={complete} onDismiss={dismiss} />
    </ThemeProvider>
  );
}
