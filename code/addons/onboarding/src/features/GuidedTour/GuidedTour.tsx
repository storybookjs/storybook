import React, { useEffect, useState } from 'react';
import type { CallBackProps } from 'react-joyride';
import Joyride, { ACTIONS } from 'react-joyride';
import { useTheme } from 'storybook/internal/theming';

import { Tooltip } from './Tooltip';
import type { StepDefinition, StepKey } from '../../Onboarding';

export function GuidedTour({
  step,
  steps,
  onClose,
  onComplete,
}: {
  step: StepKey;
  steps: StepDefinition[];
  onClose: () => void;
  onComplete: () => void;
}) {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const theme = useTheme();

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    setStepIndex((current) => {
      const index = steps.findIndex(({ key }) => key === step);
      if (index === -1) return null;
      if (index === current) return current;
      timeout = setTimeout(setStepIndex, 500, index);
      return null;
    });
    return () => clearTimeout(timeout);
  }, [step, steps]);

  if (stepIndex === null) return null;

  return (
    <Joyride
      continuous
      steps={steps}
      stepIndex={stepIndex}
      spotlightPadding={0}
      disableCloseOnEsc
      disableOverlayClose
      disableScrolling
      callback={(data: CallBackProps) => {
        if (data.action === ACTIONS.CLOSE) onClose();
        if (data.action === ACTIONS.NEXT && data.index === data.size - 1) onComplete();
      }}
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
      tooltipComponent={Tooltip}
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
}
