import React, { useCallback } from 'react';

import { type API } from 'storybook/manager-api';
import { ThemeProvider, convert } from 'storybook/theming';

import { STORYBOOK_ADDON_ONBOARDING_CHANNEL } from './constants';
import { IntentSurvey } from './features/IntentSurvey/IntentSurvey';

const theme = convert();

export default function Survey({ api }: { api: API }) {
  // eslint-disable-next-line compat/compat
  const userAgent = globalThis?.navigator?.userAgent;

  const disableOnboarding = useCallback(() => {
    // remove onboarding query parameter from current url
    const url = new URL(window.location.href);
    // @ts-expect-error (not strict)
    const path = decodeURIComponent(url.searchParams.get('path'));
    url.search = `?path=${path}&onboarding=false`;
    history.replaceState({}, '', url.href);
    api.setQueryParams({ onboarding: 'false' });
  }, [api]);

  const complete = useCallback(
    (answers: Record<string, unknown>) => {
      api.emit(STORYBOOK_ADDON_ONBOARDING_CHANNEL, {
        answers,
        type: 'survey',
        userAgent,
      });
      disableOnboarding();
    },
    [api, disableOnboarding, userAgent]
  );

  const dismiss = useCallback(() => {
    api.emit(STORYBOOK_ADDON_ONBOARDING_CHANNEL, {
      type: 'skipSurvey',
    });
    disableOnboarding();
  }, [api, disableOnboarding]);

  return (
    <ThemeProvider theme={theme}>
      <IntentSurvey onComplete={complete} onDismiss={dismiss} />
    </ThemeProvider>
  );
}
