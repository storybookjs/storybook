import React, { forwardRef, useId } from 'react';

import { TooltipNote, WithTooltip } from 'storybook/internal/components';

import { shortcutToHumanString } from '../../../manager-api';
// import { styled } from 'storybook/theming';
import type { ButtonProps } from '../Button/Button';
import { Button } from '../Button/Button';

export interface IconButtonProps extends ButtonProps {
  /** The aria-label for the IconButton. Mandatory. */
  label: string;
  // TODO: In Storybook 10, make this label mandatory? And make it optional till then?
  // label?: string;
  // TODO: consider naming it that instead of just label.
  // 'aria-label': string;

  /** An optional tooltip if you want it to be different from the aria-label. */
  tooltip?: string;

  /** A text provided to the IconButton through an aria-describedby attribute. */
  description?: string;
}

// FIXME: Does not work because emotion cannot be imported in this specific file.
// const TooltipNoteWrapper = styled(TooltipNote)(() => ({
//   margin: 0,
// }));

// TODO see how to handle delay: it should be short on the first tooltip hover.
// TODO see if WithTooltip should handle no-delay after the first hover.

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      padding = 'small',
      variant = 'ghost',
      label,
      // 'aria-label': label,
      description,
      tooltip,
      shortcut,
      ...props
    },
    ref
  ) => {
    const descriptionId = useId();

    // TODO: include deprecation warning if label is omitted?

    return (
      <WithTooltip
        trigger="hover"
        hasChrome={false}
        tooltip={
          <TooltipNote
            note={tooltip ?? `${label}${shortcut ? ` [${shortcutToHumanString(shortcut)}]` : ''}`}
          />
        }
      >
        <Button
          padding={padding}
          variant={variant}
          ref={ref}
          aria-label={label}
          aria-describedby={description ? descriptionId : undefined}
          shortcut={shortcut}
          {...props}
        />
        {description && (
          <span id={descriptionId} aria-disabled className="sb-sr-only">
            {description}
          </span>
        )}
      </WithTooltip>
    );
  }
);

IconButton.displayName = 'IconButton';
