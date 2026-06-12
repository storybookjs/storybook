import React, { type DOMAttributes, type ReactElement, useMemo } from 'react';

import { type API_KeyCollection, shortcutToHumanString } from 'storybook/manager-api';

import type { PopperPlacement } from '../../shared/overlayHelpers.tsx';
import { TooltipNote } from '../../tooltip/TooltipNote.tsx';
import { TooltipProvider } from '../../tooltip/TooltipProvider.tsx';

export const InteractiveTooltipWrapper: React.FC<{
  children: ReactElement<DOMAttributes<Element>, string>;
  shortcut?: API_KeyCollection;
  disableAllTooltips?: boolean;
  tooltip?: string;
  tooltipPlacement?: PopperPlacement;
}> = ({ children, disableAllTooltips, shortcut, tooltip, tooltipPlacement = 'top' }) => {
  const shortcutLabel = useMemo(() => {
    if (!shortcut) {
      return undefined;
    }

    // We read from document despite the lack of reactivity, because this
    // option isn't changeable in the UI. If it was, we'd need to fetch the
    // addons singleton. This component is used in Buttons, etc., which are
    // public API and can be imported in MDX. So We rely on a declarative
    // DOM attribute instead of relying on the manager API.
    const hasShortcuts = document?.body?.getAttribute('data-shortcuts-enabled') !== 'false';
    if (!hasShortcuts) {
      return undefined;
    }

    return shortcutToHumanString(shortcut);
  }, [shortcut]);

  return tooltip ? (
    <TooltipProvider
      placement={tooltipPlacement}
      tooltip={<TooltipNote note={tooltip} shortcut={shortcutLabel} />}
      visible={!disableAllTooltips ? undefined : false}
    >
      {children}
    </TooltipProvider>
  ) : (
    <>{children}</>
  );
};

InteractiveTooltipWrapper.displayName = 'InteractiveTooltipWrapper';
