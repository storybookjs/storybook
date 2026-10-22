import type { ComponentProps } from 'react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { darken } from 'polished';
import type { CallBackProps } from 'react-joyride';
import Joyride, { ACTIONS, type Step } from 'react-joyride';
import { useTheme } from 'storybook/theming';
import { ThemeProvider, convert, themes } from 'storybook/theming';

import { HighlightElement } from './HighlightElement.tsx';
import { TourTooltip } from './TourTooltip.tsx';

/**
 * A popper.js (v1) modifier that keeps the tooltip inside the viewport. Popper's `preventOverflow`
 * runs at order 300 and the arrow is placed at order 500, so this runs between them: the tooltip
 * moves, and the arrow is then placed against the target from the tooltip's final position.
 * Offsets are relative to the tooltip's offset parent, so the parent's position is added back.
 */
const keepTooltipInViewport = {
  enabled: true,
  order: 350,
  fn: <
    T extends {
      offsets: { popper: { top: number; height: number } };
      instance: { popper: Element };
    },
  >(
    data: T
  ): T => {
    const padding = 8;
    const { popper } = data.offsets;
    const parent = (data.instance.popper as HTMLElement).offsetParent;
    const parentTop = parent ? parent.getBoundingClientRect().top : 0;
    const bottomOverflow = parentTop + popper.top + popper.height - (window.innerHeight - padding);
    if (bottomOverflow > 0) {
      popper.top -= bottomOverflow;
    }
    const topOverflow = padding - (parentTop + popper.top);
    if (topOverflow > 0) {
      popper.top += topOverflow;
    }
    return data;
  },
};

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

  const resizeObserverRef = useRef<ResizeObserver | undefined>(undefined);
  useEffect(() => () => resizeObserverRef.current?.disconnect(), []);

  // Popper only repositions on scroll and window resize, so a tooltip whose content grows after it
  // opens (such as a lazily loaded code snippet) would otherwise spill out of the viewport.
  const followTooltipSize = useCallback(
    (popper: { instance: { popper: Element; update: () => void } }, origin: string) => {
      if (origin !== 'floater') {
        return;
      }
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = new ResizeObserver(() => popper.instance.update());
      resizeObserverRef.current.observe(popper.instance.popper);
    },
    []
  );

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
        // Joyride would otherwise set `overflow: initial` on a target's scroll container when that
        // container has nothing to scroll, which the sidebar's scroll area has on a short index.
        disableScrollParentFix: true,
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
        getPopper: followTooltipSize,
        disableAnimation: true,
        // Popper's own overflow prevention does not hold in the manager, whose body is pinned:
        // a tooltip next to a target low on the screen runs off the bottom, with its buttons out
        // of reach. This modifier clamps the tooltip to the viewport after popper has placed it
        // and before the arrow is positioned, so the arrow still points at the target.
        options: { keepInViewport: keepTooltipInViewport },
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
          border: `solid 2px ${theme.base === 'light' ? theme.color.secondary : darken(0.18, theme.color.secondary)}`,
          boxShadow: '0px 0px 0px 9999px rgba(27, 28, 29, 0.2)',
        },
        tooltip: {
          width: 280,
          color: theme.color.lightest,
          background:
            theme.base === 'light' ? theme.color.secondary : darken(0.18, theme.color.secondary),
        },
        options: {
          zIndex: 9998,
          primaryColor:
            theme.base === 'light' ? theme.color.secondary : darken(0.18, theme.color.secondary),
          arrowColor:
            theme.base === 'light' ? theme.color.secondary : darken(0.18, theme.color.secondary),
        },
      }}
    />
  );
};

let root: ReturnType<typeof createRoot> | null = null;

TourGuide.render = (props: ComponentProps<typeof TourGuide> | null) => {
  let container = document.getElementById('storybook-tour');
  if (!container) {
    container = document.createElement('div');
    container.id = 'storybook-tour';
    document.body.appendChild(container);
  }
  root = root ?? createRoot(container);
  root.render(
    props ? (
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
    ) : null
  );
};
