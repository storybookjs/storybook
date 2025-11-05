import React, { type DOMAttributes, type ReactElement, useMemo } from 'react';

import { type API_KeyCollection, shortcutToHumanString } from 'storybook/manager-api';

import { TooltipNote } from '../../tooltip/TooltipNote';
import { WithTooltipNew } from '../../tooltip/WithTooltipNew';

export const InteractiveTooltipWrapper: React.FC<{
  children: ReactElement<DOMAttributes<Element>, string>;
  shortcut?: API_KeyCollection;
  disableAllTooltips?: boolean;
  tooltip?: string;
}> = ({ children, disableAllTooltips, shortcut, tooltip }) => {
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

  return tooltipLabel ? (
    <WithTooltipNew
      placement="top"
      tooltip={<TooltipNote note={tooltipLabel} />}
      visible={!disableAllTooltips ? undefined : false}
    >
      {children}
    </WithTooltipNew>
  ) : (
    <>{children}</>
  );
};

InteractiveTooltipWrapper.displayName = 'InteractiveTooltipWrapper';
