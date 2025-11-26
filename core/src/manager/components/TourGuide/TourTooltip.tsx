import type { FC } from 'react';
import React, { useEffect } from 'react';

import { Button } from 'storybook/internal/components';

import { CloseAltIcon } from '@storybook/icons';

import { darken, lighten, transparentize } from 'polished';
import type { Step, TooltipRenderProps } from 'react-joyride';
import { color, styled } from 'storybook/theming';

const ONBOARDING_ARROW_STYLE_ID = 'storybook-onboarding-arrow-style';

const TooltipBody = styled.div`
  padding: 15px;
  border-radius: 5px;
`;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const TooltipHeader = styled.div`
  display: flex;
  align-items: center;
  align-self: stretch;
  justify-content: space-between;
  margin: -5px -5px 5px 0;
`;

const TooltipTitle = styled.div`
  line-height: 18px;
  font-weight: 700;
  font-size: 14px;
  margin: 5px 5px 5px 0;
`;

const TooltipContent = styled.p`
  font-size: 14px;
  line-height: 18px;
  text-align: start;
  text-wrap: balance;
  margin: 0;
  margin-top: 5px;
`;

const TooltipFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 15px;
`;

const Count = styled.span`
  font-size: 13px;
`;

const NextButton = styled(Button)(({ theme }) => ({
  background: theme.color.lightest,
  border: 'none',
  boxShadow: 'none',
  color: theme.base === 'light' ? theme.color.secondary : darken(0.18, theme.color.secondary),

  '&:hover, &:focus': {
    background: transparentize(0.1, theme.color.lightest),
    color:
      theme.base === 'light'
        ? lighten(0.1, theme.color.secondary)
        : darken(0.3, theme.color.secondary),
  },
}));

type TooltipProps = {
  index: number;
  size: number;
  step: Partial<
    Pick<
      // this only seems to happen during the check task, nos in vsCode..
      // this seems to be 'any' in vsCode because of it?
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore (hide property 'input' circularly references itself in mapped type)
      Step,
      | 'title'
      | 'content'
      | 'target'
      | 'offset'
      | 'placement'
      | 'disableOverlay'
      | 'disableBeacon'
      | 'floaterProps'
      | 'spotlightClicks'
      | 'styles'
    > & {
      hideNextButton: boolean;
    }
  >;
  closeProps: TooltipRenderProps['closeProps'];
  primaryProps: TooltipRenderProps['primaryProps'];
  tooltipProps: TooltipRenderProps['tooltipProps'];
};

export const TourTooltip: FC<TooltipProps> = ({
  index,
  size,
  step,
  closeProps,
  primaryProps,
  tooltipProps,
}) => {
  useEffect(() => {
    const style = document.createElement('style');
    style.id = ONBOARDING_ARROW_STYLE_ID;
    style.innerHTML = `
      .__floater__arrow { container-type: size; }
      .__floater__arrow span { background: ${color.secondary}; }
      .__floater__arrow span::before, .__floater__arrow span::after {
        content: '';
        display: block;
        width: 2px;
        height: 2px;
        background: ${color.secondary};
        box-shadow: 0 0 0 2px ${color.secondary};
        border-radius: 3px;
        flex: 0 0 2px;
      }
      @container (min-height: 1px) {
        .__floater__arrow span { flex-direction: column; }
      }
    `;
    document.head.appendChild(style);
    return () => document.getElementById(ONBOARDING_ARROW_STYLE_ID)?.remove();
  }, []);

  return (
    <TooltipBody {...tooltipProps} style={step.styles?.tooltip}>
      <Wrapper>
        <TooltipHeader>
          {step.title && <TooltipTitle>{step.title}</TooltipTitle>}
          <Button
            {...closeProps}
            onClick={closeProps.onClick as any}
            variant="solid"
            padding="small"
            ariaLabel="Close"
          >
            <CloseAltIcon />
          </Button>
        </TooltipHeader>
        <TooltipContent>{step.content}</TooltipContent>
      </Wrapper>
      <TooltipFooter id="buttonNext">
        <Count>
          {index + 1} of {size}
        </Count>
        {!step.hideNextButton && (
          <NextButton {...primaryProps}>{index + 1 === size ? 'Done' : 'Next'}</NextButton>
        )}
      </TooltipFooter>
    </TooltipBody>
  );
};
