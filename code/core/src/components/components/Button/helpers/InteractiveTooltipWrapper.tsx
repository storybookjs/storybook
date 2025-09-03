import React, { useMemo } from 'react';

import { shortcutToHumanString } from 'storybook/internal/manager-api';
import type { API_KeyCollection } from 'storybook/internal/manager-api';

import { styled } from 'storybook/theming';

import { TooltipNote } from '../../tooltip/TooltipNote';
import { WithTooltip } from '../../tooltip/WithTooltip';

const NoMarginNote = styled(TooltipNote)(() => ({
  margin: 0,
}));

// TODO: Port to new react aria tooltip

export const InteractiveTooltipWrapper: React.FC<{
  children: React.ReactNode;
  shortcut?: API_KeyCollection;
  tooltip?: string;
}> = ({ children, shortcut, tooltip }) => {
  const tooltipLabel = useMemo(() => {
    // We read from document despite the lack of reactivity, because this
    // option isn't changeable in the UI. If it was, we'd need to fetch the
    // addons singleton. This component is used in Buttons, etc., which are
    // public API and can be imported in MDX. So We rely on a declarative
    // DOM attribute instead of relying on the manager API.
    const hasShortcuts = document.body.getAttribute('data-shortcuts-enabled') === 'true';

    if (!tooltip && (!shortcut || !hasShortcuts)) {
      return undefined;
    }

    return [tooltip, shortcut && hasShortcuts && `[${shortcutToHumanString(shortcut)}]`]
      .filter(Boolean)
      .join(' ');
  }, [shortcut, tooltip]);

  return tooltipLabel ? (
    <WithTooltip trigger="hover" hasChrome={false} tooltip={<NoMarginNote note={tooltipLabel} />}>
      {children}
    </WithTooltip>
  ) : (
    <>{children}</>
  );
};

InteractiveTooltipWrapper.displayName = 'InteractiveTooltipWrapper';
