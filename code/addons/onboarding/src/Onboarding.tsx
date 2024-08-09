import React, { useCallback, useEffect, useState } from 'react';

import { SyntaxHighlighter } from 'storybook/internal/components';
import { SAVE_STORY_RESPONSE } from 'storybook/internal/core-events';
import { type API } from 'storybook/internal/manager-api';
import { ThemeProvider, convert, styled, themes } from 'storybook/internal/theming';

import type { Step } from 'react-joyride';

import { Confetti } from './components/Confetti/Confetti';
import { HighlightElement } from './components/HighlightElement/HighlightElement';
import type { STORYBOOK_ADDON_ONBOARDING_STEPS } from './constants';
import { STORYBOOK_ADDON_ONBOARDING_CHANNEL } from './constants';
import { GuidedTour } from './features/GuidedTour/GuidedTour';
import { SplashScreen } from './features/SplashScreen/SplashScreen';

const SpanHighlight = styled.span(({ theme }) => ({
  display: 'inline-flex',
  borderRadius: 3,
  padding: '0 5px',
  marginBottom: -2,
  opacity: 0.8,
  fontFamily: theme.typography.fonts.mono,
  fontSize: 11,
  border: theme.base === 'dark' ? theme.color.darkest : theme.color.lightest,
  color: theme.base === 'dark' ? theme.color.lightest : theme.color.darkest,
  backgroundColor: theme.base === 'dark' ? 'black' : theme.color.light,
  boxSizing: 'border-box',
  lineHeight: '17px',
}));

const CodeWrapper = styled.div(({ theme }) => ({
  background: theme.background.content,
  borderRadius: 3,
  marginTop: 15,
  padding: 10,
  fontSize: theme.typography.size.s1,
  '.linenumber': {
    opacity: 0.5,
  },
}));

const theme = convert();

export type StepKey = (typeof STORYBOOK_ADDON_ONBOARDING_STEPS)[number];
export type StepDefinition = {
  key: StepKey;
  hideNextButton?: boolean;
  onNextButtonClick?: () => void;
} & Partial<
  Pick<
    // Unfortunately we can't use ts-expect-error here for some reason
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Ignore circular reference
    Step,
    | 'content'
    | 'disableBeacon'
    | 'disableOverlay'
    | 'floaterProps'
    | 'offset'
    | 'placement'
    | 'spotlightClicks'
    | 'styles'
    | 'target'
    | 'title'
  >
>;

export default function Onboarding({ api }: { api: API }) {
  const [enabled, setEnabled] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [step, setStep] = useState<StepKey>('1:Intro');

  const [primaryControl, setPrimaryControl] = useState<HTMLElement | null>();
  const [saveFromControls, setSaveFromControls] = useState<HTMLElement | null>();
  const [createNewStoryForm, setCreateNewStoryForm] = useState<HTMLElement | null>();
  const [createdStory, setCreatedStory] = useState<{
    newStoryName: string;
    newStoryExportName: string;
    sourceFileContent: string;
    sourceFileName: string;
  } | null>();

  const selectStory = useCallback(
    (storyId: string) => {
      try {
        const { id, refId } = api.getCurrentStoryData() || {};
        if (id !== storyId || refId !== undefined) api.selectStory(storyId);
      } catch (e) {}
    },
    [api]
  );

  const disableOnboarding = useCallback(() => {
    // remove onboarding query parameter from current url
    const url = new URL(window.location.href);
    // @ts-expect-error (not strict)
    const path = decodeURIComponent(url.searchParams.get('path'));
    url.search = `?path=${path}&onboarding=false`;
    history.replaceState({}, '', url.href);
    api.setQueryParams({ onboarding: 'false' });
    setEnabled(false);
  }, [api, setEnabled]);

  const completeOnboarding = useCallback(() => {
    api.emit(STORYBOOK_ADDON_ONBOARDING_CHANNEL, {
      step: '6:FinishedOnboarding' satisfies StepKey,
      type: 'telemetry',
    });
    selectStory('configure-your-project--docs');
    disableOnboarding();
  }, [api, selectStory, disableOnboarding]);

  useEffect(() => {
    api.setQueryParams({ onboarding: 'true' });
    selectStory('example-button--primary');
    api.togglePanel(true);
    api.togglePanelPosition('bottom');
    api.setSelectedPanel('addon-controls');
  }, [api, selectStory]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setPrimaryControl(document.getElementById('control-primary'));
      setSaveFromControls(document.getElementById('save-from-controls'));
      setCreateNewStoryForm(document.getElementById('create-new-story-form'));
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setStep((current) => {
      if (['1:Intro', '5:StoryCreated', '6:FinishedOnboarding'].includes(current)) return current;
      if (createNewStoryForm) return '4:CreateStory';
      if (saveFromControls) return '3:SaveFromControls';
      if (primaryControl) return '2:Controls';
      return '1:Intro';
    });
  }, [createNewStoryForm, primaryControl, saveFromControls]);

  useEffect(() => {
    return api.on(SAVE_STORY_RESPONSE, ({ payload, success }) => {
      if (!success || !payload?.newStoryName) return;
      setCreatedStory(payload);
      setShowConfetti(true);
      setStep('5:StoryCreated');
      setTimeout(() => api.clearNotification('save-story-success'));
    });
  }, [api]);

  useEffect(
    () => api.emit(STORYBOOK_ADDON_ONBOARDING_CHANNEL, { step, type: 'telemetry' }),
    [api, step]
  );

  if (!enabled) {
    return null;
  }

  const source = createdStory?.sourceFileContent;
  const startIndex = source?.lastIndexOf(`export const ${createdStory?.newStoryExportName}`);
  const snippet = source?.slice(startIndex).trim();
  const startingLineNumber = source?.slice(0, startIndex).split('\n').length;

  const steps: StepDefinition[] = [
    {
      key: '2:Controls',
      target: '#control-primary',
      title: 'Interactive story playground',
      content: (
        <>
          See how a story renders with different data and state without touching code. Try it out by
          toggling this button.
          <HighlightElement targetSelector="#control-primary" pulsating />
        </>
      ),
      offset: 20,
      placement: 'right',
      disableBeacon: true,
      disableOverlay: true,
      spotlightClicks: true,
      onNextButtonClick: () => {
        const input = document.querySelector('#control-primary') as HTMLInputElement;
        input.click();
      },
    },
    {
      key: '3:SaveFromControls',
      target: 'button[aria-label="Create new story with these settings"]',
      title: 'Save your changes as a new story',
      content: (
        <>
          Great! Storybook stories represent the key states of each of your components. After
          modifying a story, you can save your changes from here or reset it.
          <HighlightElement targetSelector="button[aria-label='Create new story with these settings']" />
        </>
      ),
      offset: 6,
      placement: 'top',
      disableBeacon: true,
      disableOverlay: true,
      spotlightClicks: true,
      onNextButtonClick: () => {
        const button = document.querySelector(
          'button[aria-label="Create new story with these settings"]'
        ) as HTMLButtonElement;
        button.click();
      },
      styles: {
        tooltip: {
          width: 400,
        },
      },
    },
    {
      key: '5:StoryCreated',
      target: '#storybook-explorer-tree [data-selected="true"]',
      title: 'You just added your first story!',
      content: (
        <>
          Well done! You just created your first story from the Storybook manager. This
          automatically added a few lines of code in{' '}
          <SpanHighlight>{createdStory?.sourceFileName}</SpanHighlight>.
          {snippet && (
            <ThemeProvider theme={convert(themes.dark)}>
              <CodeWrapper>
                <SyntaxHighlighter
                  language="jsx"
                  showLineNumbers
                  startingLineNumber={startingLineNumber}
                >
                  {snippet}
                </SyntaxHighlighter>
              </CodeWrapper>
            </ThemeProvider>
          )}
        </>
      ),
      offset: 12,
      placement: 'right',
      disableBeacon: true,
      disableOverlay: true,
      styles: {
        tooltip: {
          width: 400,
        },
      },
    },
  ] as const;

  return (
    <ThemeProvider theme={theme}>
      {showConfetti && (
        <Confetti
          numberOfPieces={800}
          recycle={false}
          tweenDuration={20000}
          onConfettiComplete={(confetti) => {
            confetti?.reset();
            setShowConfetti(false);
          }}
        />
      )}
      {step === '1:Intro' ? (
        <SplashScreen onDismiss={() => setStep('2:Controls')} />
      ) : (
        <GuidedTour
          step={step}
          steps={steps}
          onClose={disableOnboarding}
          onComplete={completeOnboarding}
        />
      )}
    </ThemeProvider>
  );
}
