import type { ComponentProps } from 'react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { darken } from 'polished';
import type { CallBackProps } from 'react-joyride';
import Joyride, { ACTIONS, type Step } from 'react-joyride';
import { useTheme } from 'storybook/theming';
import { ThemeProvider, convert, themes } from 'storybook/theming';

import { HighlightElement } from './HighlightElement';
import { TourTooltip } from './TourTooltip';

type StepDefinition = {
  key?: string;
  highlight?: string;
  hideNextButton?: boolean;
  onNext?: ({ next }: { next: () => void }) => void;
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

export const TourGuide = ({
  step,
  steps,
  onNext,
  onComplete,
  onDismiss,
}: {
  step?: string;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore Circular reference in Step type
  steps: StepDefinition[];
  onNext?: ({ next }: { next: () => void }) => void;
  onComplete?: () => void;
  onDismiss?: () => void;
}) => {
  const [stepIndex, setStepIndex] = useState<number | null>(step ? null : 0);
  const theme = useTheme();

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const updateStepIndex = useCallback((index: number) => {
    clearTimeout(timeoutRef.current);
    setStepIndex((current) => {
      if (index === -1) {
        return null;
      }
      if (current === null || current === index) {
        return index;
      }
      // Briefly hide the tour tooltip while switching steps
      timeoutRef.current = setTimeout(setStepIndex, 300, index);
      return null;
    });
  }, []);

  useEffect(
    () => (step ? updateStepIndex(steps.findIndex(({ key }) => key === step)) : undefined),
    [step, steps, updateStepIndex]
  );

  const mappedSteps = useMemo(() => {
    return steps.map((step, index) => {
      const next = () => updateStepIndex(index + 1);
      return {
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
        onNext: step.onNext ? () => step.onNext?.({ next }) : onNext && (() => onNext?.({ next })),
      };
    });
  }, [steps, onNext, updateStepIndex]);

  const callback = useCallback(
    (data: CallBackProps) => {
      if (data.action === ACTIONS.NEXT && data.lifecycle === 'complete') {
        if (data.index === data.size - 1) {
          onComplete?.();
        } else if (data.step?.onNext) {
          data.step.onNext();
        } else {
          updateStepIndex(data.index + 1);
        }
      }
      if (data.action === ACTIONS.CLOSE) {
        onDismiss?.();
      }
    },
    [onComplete, onDismiss, updateStepIndex]
  );

  if (stepIndex === null) {
    return null;
  }

  return (
    <Joyride
      continuous
      steps={mappedSteps}
      stepIndex={stepIndex}
      spotlightPadding={0}
      disableCloseOnEsc
      disableOverlayClose
      disableScrolling
      callback={callback}
      tooltipComponent={TourTooltip}
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
          border: `solid 2px ${theme.base === 'light' ? 'var(--sb-color-secondary)' : darken(0.18, theme.color.secondary)}`,
          boxShadow: '0px 0px 0px 9999px rgba(27, 28, 29, 0.2)',
        },
        tooltip: {
          width: 280,
          color: 'var(--sb-color-lightest)',
          background:
            theme.base === 'light'
              ? 'var(--sb-color-secondary)'
              : darken(0.18, theme.color.secondary),
        },
        options: {
          zIndex: 9998,
          primaryColor:
            theme.base === 'light'
              ? 'var(--sb-color-secondary)'
              : darken(0.18, theme.color.secondary),
          arrowColor:
            theme.base === 'light'
              ? 'var(--sb-color-secondary)'
              : darken(0.18, theme.color.secondary),
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
        onComplete={() => {
          props.onComplete?.();
          root?.render(null);
          root = null;
        }}
        onDismiss={() => {
          props.onDismiss?.();
          root?.render(null);
          root = null;
        }}
      />
    </ThemeProvider>
  );
};
