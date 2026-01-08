import React, { useCallback, useEffect, useState } from 'react';

import { type API } from 'storybook/manager-api';
import { ThemeProvider, convert } from 'storybook/theming';

import { ADDON_ONBOARDING_CHANNEL } from './constants';
import { IntentSurvey } from './features/IntentSurvey/IntentSurvey';

const theme = convert();

export default function Survey({ api }: { api: API }) {
  // eslint-disable-next-line compat/compat
  const userAgent = globalThis?.navigator?.userAgent;

  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    api.emit(ADDON_ONBOARDING_CHANNEL, {
      from: 'guide',
      type: 'openSurvey',
      userAgent,
    });
  }, [api, userAgent]);

  const disableOnboarding = useCallback(() => {
    setIsOpen(false);
    api.applyQueryParams({ onboarding: undefined }, { replace: true });
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
      <IntentSurvey isOpen={isOpen} onComplete={complete} onDismiss={dismiss} />
    </ThemeProvider>
  );
}
