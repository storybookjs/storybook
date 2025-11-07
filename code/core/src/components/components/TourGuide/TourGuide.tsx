import type { ComponentProps } from 'react';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { CallBackProps } from 'react-joyride';
import Joyride, { ACTIONS, type Step } from 'react-joyride';
import { useTheme } from 'storybook/theming';
import { ThemeProvider, convert, themes } from 'storybook/theming';

import { HighlightElement } from './HighlightElement';
import { Tooltip } from './Tooltip';

export const TourGuide = ({
  steps,
  onClose,
}: {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore Circular reference in Step type
  steps: (Step & {
    highlight?: string;
    onNextButtonClick?: ({ setStepIndex }: { setStepIndex: (index: number) => void }) => void;
  })[];
  onClose?: () => void;
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const theme = useTheme();

  const next = () => setStepIndex((v) => v + 1);

  const mappedSteps = steps.map((step) => ({
    disableBeacon: true,
    disableOverlay: true,
    spotlightClicks: true,
    offset: 0,
    ...step,
    content: (
      <>
        {step.content}
        {step.highlight && <HighlightElement targetSelector={step.highlight} pulsating />}
      </>
    ),
    onNextButtonClick: step.onNextButtonClick && (() => step.onNextButtonClick({ next })),
  }));

  return (
    <Joyride
      continuous
      steps={mappedSteps}
      stepIndex={stepIndex}
      spotlightPadding={0}
      disableCloseOnEsc
      disableOverlayClose
      disableScrolling
      callback={(data: CallBackProps) => data.action === ACTIONS.CLOSE && onClose?.()}
      tooltipComponent={Tooltip}
      floaterProps={{
        disableAnimation: true,
        styles: {
          arrow: {
            length: 20,
            spread: 2,
          },
          floater: {
            filter:
              theme.base === 'light'
                ? 'drop-shadow(0px 5px 5px rgba(0,0,0,0.05)) drop-shadow(0 1px 3px rgba(0,0,0,0.1))'
                : 'drop-shadow(#fff5 0px 0px 0.5px) drop-shadow(#fff5 0px 0px 0.5px)',
          },
        },
      }}
      styles={{
        overlay: {
          mixBlendMode: 'unset',
          backgroundColor: steps[stepIndex]?.target === 'body' ? 'rgba(27, 28, 29, 0.2)' : 'none',
        },
        spotlight: {
          backgroundColor: 'none',
          border: `solid 2px ${theme.color.secondary}`,
          boxShadow: '0px 0px 0px 9999px rgba(27, 28, 29, 0.2)',
        },
        tooltip: {
          width: 280,
          color: theme.color.lightest,
          background: theme.color.secondary,
        },
        options: {
          zIndex: 9998,
          primaryColor: theme.color.secondary,
          arrowColor: theme.color.secondary,
        },
      }}
    />
  );
};

let root: ReturnType<typeof createRoot> | null = null;

TourGuide.render = (props: ComponentProps<typeof TourGuide>) => {
  let container = document.getElementById('storybook-tour');
  if (!container) {
    container = document.createElement('div');
    container.id = 'storybook-tour';
    document.body.appendChild(container);
  }
  root = root ?? createRoot(container);
  root.render(
    <ThemeProvider theme={convert(themes.light)}>
      <TourGuide
        {...props}
        onClose={() => {
          props.onClose?.();
          root?.render(null);
          root = null;
        }}
      />
    </ThemeProvider>
  );
};
