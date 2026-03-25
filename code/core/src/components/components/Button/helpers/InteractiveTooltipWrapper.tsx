import React, {
  type AriaAttributes,
  type DOMAttributes,
  type FC,
  type ReactElement,
  useMemo,
} from 'react';

import { type API_KeyCollection, shortcutToHumanString } from 'storybook/manager-api';

import { TooltipNote } from '../../tooltip/TooltipNote';
import { TooltipProvider } from '../../tooltip/TooltipProvider';
import { useAriaDescription } from './useAriaDescription';

export interface InteractiveTooltipWrapperProps {
  children: ReactElement<DOMAttributes<Element> & AriaAttributes, string>;
  shortcut?: API_KeyCollection;
  disableAllTooltips?: boolean;
  tooltip?: string;
  ariaDescription?: string;
}

export const InteractiveTooltipWrapper: FC<InteractiveTooltipWrapperProps> = ({
  children,
  disableAllTooltips,
  shortcut,
  tooltip,
  ariaDescription = undefined,
}) => {
  const { ariaDescriptionAttrs, AriaDescription } = useAriaDescription(ariaDescription);
  const childWithAriaDescription = ariaDescriptionAttrs['aria-describedby']
    ? React.cloneElement(children, ariaDescriptionAttrs)
    : children;
  const tooltipTriggerChild = childWithAriaDescription as ReactElement<
    DOMAttributes<Element>,
    string
  >;
  const tooltipLabel = useMemo(() => {
    // We read from document despite the lack of reactivity, because this
    // option isn't changeable in the UI. If it was, we'd need to fetch the
    // addons singleton. This component is used in Buttons, etc., which are
    // public API and can be imported in MDX. So We rely on a declarative
    // DOM attribute instead of relying on the manager API.
    const hasShortcuts = document?.body?.getAttribute('data-shortcuts-enabled') !== 'false';

    if (!tooltip && (!shortcut || !hasShortcuts)) {
      return undefined;
    }

    return [tooltip, shortcut && hasShortcuts && `[${shortcutToHumanString(shortcut)}]`]
      .filter(Boolean)
      .join(' ');
  }, [shortcut, tooltip]);

  return (
    <>
      {tooltipLabel ? (
        <TooltipProvider
          placement="top"
          tooltip={<TooltipNote note={tooltipLabel} />}
          visible={!disableAllTooltips ? undefined : false}
          overrideAriaDescribedby={ariaDescriptionAttrs['aria-describedby']}
        >
          {tooltipTriggerChild}
        </TooltipProvider>
      ) : (
        <>{childWithAriaDescription}</>
      )}
      <AriaDescription />
    </>
  );
};

InteractiveTooltipWrapper.displayName = 'InteractiveTooltipWrapper';
