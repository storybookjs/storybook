import type { FC, KeyboardEvent } from 'react';
import React, { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import type { ButtonProps } from 'storybook/internal/components';
import { Button, ScrollArea } from 'storybook/internal/components';

import { RefreshIcon } from '@storybook/icons';

import { useObjectRef } from '@react-aria/utils';
import { lighten, transparentize } from 'polished';
import { Overlay, useInteractOutside, useOverlay, useOverlayPosition } from 'react-aria';
import { useOverlayTriggerState } from 'react-stately';
import { styled } from 'storybook/theming';

import { Tooltip } from '../tooltip/Tooltip';
import { SelectOption } from './SelectOption';
import type { Option, ResetOption } from './helpers';
import { Listbox, PAGE_STEP_SIZE } from './helpers';

export interface SelectProps
  extends Omit<ButtonProps, 'onClick' | 'onChange' | 'onSelect' | 'variant'> {
  size?: 'small' | 'medium';
  padding?: 'small' | 'medium' | 'none';

  /**
   * Whether multiple options can be selected. In single select mode, this component acts like a
   * HTML select element where the selected option follows focus. In multi select mode, it acts like
   * a combobox and does not autoclose on select or autoselect the focused option.
   */
  multiSelect?: boolean;

  /**
   * Mandatory label that explains what is being selected. Do not include "change", "toggle" or
   * "select" verbs in the label. Instead, only describe the type of content with a noun.
   */
  ariaLabel: string;

  /**
   * Label for the Select component. In single-select mode, is replaced by the currently selected
   * option's title.
   */
  children?: React.ReactNode;

  /**
   * Icon shown next to the Select's children, still displayed when a value is selected and Select
   * shows that value instead of children.
   */
  icon?: React.ReactNode;

  /** Whether the Select is currently disabled. */
  disabled?: boolean;

  /** Options available in the select. */
  options: Option[];

  /** IDs of the preselected options. */
  defaultOptions?: string | string[];

  /** Whether the Select should render open. */
  defaultOpen?: boolean;

  /** When set, a reset option is rendered in the Select listbox. */
  onReset?: () => void;

  /** Custom text label for the reset option when it exists. */
  resetLabel?: string;

  onSelect?: (option: string) => void;
  onDeselect?: (option: string) => void;
  onChange?: (selected: string[]) => void;
}

function valueToId(parentId: string, { value }: ResetOption | Option): string {
  return `${parentId}-opt-${value ?? 'sb-reset'}`;
}

const SelectedOptionCount = styled.span(({ theme }) => ({
  appearance: 'none',
  color: theme.textMutedColor,
  fontSize: 12,
}));

function setSelectedFromDefault(
  options: SelectProps['options'],
  defaultOptions: SelectProps['defaultOptions']
): Option[] {
  if (!defaultOptions) {
    return [];
  }

  if (typeof defaultOptions === 'string') {
    return options.filter((opt) => opt.value === defaultOptions);
  }

  return options.filter((opt) => defaultOptions.some((def) => opt.value === def));
}

const StyledButton = styled(Button)<ButtonProps & { hasSelection?: boolean; isOpen?: boolean }>(
  ({ isOpen, hasSelection, theme }) => ({
    ...(isOpen || hasSelection
      ? {
          boxShadow: 'none',
          background: transparentize(0.93, theme.barSelectedColor),
          color: theme.barSelectedColor,

          // This is a hack to apply bar styles to the button as soon as it is part of a bar
          // It is a temporary solution until we have implemented Theming 2.0.
          '.sb-bar &': {
            background: transparentize(0.93, theme.barSelectedColor),
            color: theme.barSelectedColor,
          },
        }
      : {}),
  })
);

const Underlay = styled.div({
  position: 'fixed',
  inset: 0,
  // This will do for now, our popovers use the max z-index of 2147483647. We'll want to
  // inherit a base from a CSS variable and add preset values to it in the future (e.g.
  // 100 for underlay, 200 for overlay) if we start using Select in dialogs.
  zIndex: 1000,
});

/*
 * This popover does not do any keyboard handling or placement. It uses a portal to place
 * its children under its sibling's position. When clicking outside the popover, it closes.
 */
const MinimalistPopover: FC<{
  children: React.ReactNode;
  handleClose: () => void;
  triggerRef: React.RefObject<HTMLElement>;
}> = ({ children, handleClose, triggerRef }) => {
  const popoverRef = React.useRef(null);

  useInteractOutside({
    ref: popoverRef,
    onInteractOutside: handleClose,
  });

  const { overlayProps: positionProps } = useOverlayPosition({
    targetRef: triggerRef,
    overlayRef: popoverRef,
    placement: 'bottom start',
    offset: 8,
    isOpen: true,
  });

  const { overlayProps, underlayProps } = useOverlay(
    {
      isOpen: true,
      onClose: handleClose,
      isDismissable: true,
      /* We do this ourselves. */
      shouldCloseOnBlur: false,
      /* We also do this ourselves. */
      isKeyboardDismissDisabled: true,
    },
    popoverRef
  );

  return (
    <Overlay disableFocusManagement {...overlayProps}>
      <Underlay {...underlayProps} />
      <Tooltip hasChrome ref={popoverRef} {...positionProps}>
        {children}
      </Tooltip>
    </Overlay>
  );
};

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      children,
      icon,
      disabled = false,
      options: calleeOptions,
      defaultOptions,
      multiSelect = false,
      onReset,
      padding = 'small',
      resetLabel,
      onSelect,
      onDeselect,
      onChange,
      tooltip,
      ariaLabel,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(props.defaultOpen || false);
    const triggerRef = useObjectRef(ref);

    const id = useId();
    const listboxId = `${id}-listbox`;
    const listboxRef = useRef<HTMLUListElement>(null);

    const otState = useOverlayTriggerState({
      isOpen: isOpen && !disabled,
      onOpenChange: setIsOpen,
    });

    const handleClose = useCallback(() => {
      setIsOpen(false);
      triggerRef.current?.focus();
    }, [triggerRef]);

    // The last selected option(s), which will be used by the app.
    const [selectedOptions, setSelectedOptions] = useState<Option[]>(
      setSelectedFromDefault(calleeOptions, defaultOptions)
    );

    // Selects an option (updating the selection state based on multiSelect).
    const handleSelectOption = useCallback(
      (option: Option | ResetOption) => {
        // Reset option case. We check value === undefined for cleaner type handling in the other branch.
        if (option.value === undefined) {
          if (selectedOptions.length) {
            onChange?.([]);
            onReset?.();
            setSelectedOptions([]);
          }
        } else if (multiSelect) {
          setSelectedOptions((previous) => {
            let newSelected: Option[] = [];

            const isSelected = previous?.some((opt) => opt.value === option.value);
            if (isSelected) {
              onDeselect?.(option.value);
              newSelected = previous?.filter((opt) => opt.value !== option.value) ?? [];
            } else {
              onSelect?.(option.value);
              newSelected = [...(previous ?? []), option];
            }

            onChange?.(newSelected.map((opt) => opt.value));
            return newSelected;
          });
        } else {
          setSelectedOptions((current) => {
            if (current.every((opt) => opt.value !== option.value)) {
              onSelect?.(option.value);
              onChange?.([option.value]);
              return [option];
            }
            return current;
          });
        }
      },
      [multiSelect, onChange, onSelect, onDeselect, onReset, selectedOptions]
    );

    // Reset option appears if a handler is defined and there are selected options.
    const resetOption = useMemo(
      () =>
        onReset
          ? {
              value: undefined,
              title: resetLabel ?? 'Reset selection',
              icon: <RefreshIcon />,
              description: undefined,
              children: undefined,
            }
          : undefined,
      [onReset, resetLabel]
    );

    // Synthetic object allowing us to implement the roving tabindex.
    const options = useMemo(
      () => (resetOption ? [resetOption, ...calleeOptions] : calleeOptions),
      [calleeOptions, resetOption]
    );

    // We must do this to account for callees that have an unstable data model.
    // For instance, when a URL query param is passed for the theme addon, the
    // addon receives, undefined, then the default theme value (incorrectly),
    // then the actual URL query param as a selected theme.
    useEffect(() => {
      if (defaultOptions) {
        setSelectedOptions(setSelectedFromDefault(calleeOptions, defaultOptions));
      }
    }, [defaultOptions, calleeOptions]);

    // The active option in the listbox, which will receive focus when the listbox is open.
    const [activeOption, setActiveOptionState] = useState<Option | ResetOption | undefined>(
      undefined
    );

    // In single select mode, the active option is the selected one, so we
    // wrap setActiveOption to handle selection. We never close the listbox
    // in that scenario.
    const setActiveOption = useCallback(
      (option: Option | ResetOption) => {
        setActiveOptionState(option);
        if (!multiSelect) {
          handleSelectOption(option);
        }
      },
      [multiSelect, handleSelectOption]
    );

    const moveActiveOptionDown = useCallback(
      (step = 1) => {
        if (!isOpen || !activeOption) {
          setActiveOption(options[0]);
          return;
        }
        const currentIndex = options.findIndex((option) => option.value === activeOption.value);
        const nextIndex = currentIndex + step;

        // Loop over to the start if we're already on the last option.
        let newActiveOption;
        if (nextIndex >= options.length && currentIndex === options.length - 1) {
          newActiveOption = options[0];
        } else {
          newActiveOption = options[Math.min(options.length - 1, nextIndex)];
        }

        setActiveOption(newActiveOption);
      },
      [isOpen, activeOption, setActiveOption, options]
    );

    const moveActiveOptionUp = useCallback(
      (step = 1) => {
        if (!isOpen || !activeOption) {
          setActiveOption(options[options.length - 1]);
          return;
        }
        const currentIndex = options.findIndex((option) => option.value === activeOption.value);
        const nextIndex = currentIndex - step;

        // Loop over to the end if we're already on the first option.
        let newActiveOption;
        if (nextIndex < 0 && currentIndex === 0) {
          newActiveOption = options[options.length - 1];
        } else {
          newActiveOption = options[Math.max(0, nextIndex)];
        }

        setActiveOption(newActiveOption);
      },
      [isOpen, activeOption, setActiveOption, options]
    );

    const handleButtonKeyDown = useCallback(
      (e: KeyboardEvent<HTMLButtonElement>) => {
        const openAt = (index: number) => {
          e.preventDefault();
          setActiveOption(options[index]);
          setIsOpen(true);
        };

        // If there is a selection, we'll open the Select around the first selected option.
        // If not, around the edges of the list.
        const indexOfFirstSelected = options.findIndex((option) =>
          selectedOptions.some((sel) => sel.value === option.value)
        );
        const hasSelection = indexOfFirstSelected !== -1;

        // When the Select has a reset option, but nothing is selected, it
        // makes no sense to open on the Reset option. We start on the first
        // actual option.
        const listStart = resetOption && !hasSelection ? 1 : 0;
        const listEnd = options.length - 1;

        // When we press ArrowUp/Down, we want to stay close to the edges rather than
        // initiate movement. When we press Home/End or PageUp/PageDown, we want to
        // move immediately because it's clearer the user intends to be in a specific
        // area of the list. This is why we don't always do +/- 1 but always do +/- PAGE_STEP_SIZE.
        if (e.key === 'Enter' || e.key === ' ') {
          openAt(hasSelection ? Math.min(indexOfFirstSelected, listEnd) : listStart);
        } else if (e.key === 'ArrowDown') {
          openAt(hasSelection ? Math.min(indexOfFirstSelected + 1, listEnd) : listStart);
        } else if (e.key === 'ArrowUp') {
          openAt(hasSelection ? Math.max(indexOfFirstSelected - 1, listStart) : listEnd);
        } else if (e.key === 'Home') {
          openAt(listStart);
        } else if (e.key === 'End') {
          openAt(listEnd);
        } else if (e.key === 'PageDown') {
          openAt(
            Math.min((hasSelection ? indexOfFirstSelected : listStart) + PAGE_STEP_SIZE, listEnd)
          );
        } else if (e.key === 'PageUp') {
          openAt(Math.max(0, (hasSelection ? indexOfFirstSelected : listEnd) - PAGE_STEP_SIZE));
        }
      },
      [options, resetOption, setActiveOption, selectedOptions]
    );

    const handleListboxKeyDown = useCallback(
      (e: KeyboardEvent<HTMLUListElement>) => {
        // We don't prevent default on Tab, so that the Tab or Shift+Tab goes
        // through after we've repositioned to the Button.
        if (e.key !== 'Tab') {
          e.preventDefault();
        } else {
          handleClose();
        }

        if (e.key === 'Escape') {
          handleClose();
        } else if (e.key === 'ArrowDown') {
          moveActiveOptionDown();
        } else if (e.key === 'ArrowUp') {
          moveActiveOptionUp();
        } else if (e.key === 'Home') {
          setActiveOption(options[0]);
        } else if (e.key === 'End') {
          setActiveOption(options[options.length - 1]);
        } else if (e.key === 'PageDown') {
          moveActiveOptionDown(PAGE_STEP_SIZE);
        } else if (e.key === 'PageUp') {
          moveActiveOptionUp(PAGE_STEP_SIZE);
        }
      },
      [handleClose, moveActiveOptionDown, moveActiveOptionUp, options, setActiveOption]
    );

    // Transfer focus to the active option whenever we open the listbox.
    useEffect(() => {
      if (isOpen && activeOption) {
        const optionElement = document.getElementById(valueToId(id, activeOption));

        if (optionElement) {
          optionElement.scrollIntoView({ block: 'nearest' });
          optionElement.focus();
        }
      }
    }, [isOpen, activeOption, id]);

    return (
      <>
        <StyledButton
          {...props}
          variant="ghost"
          ariaLabel={ariaLabel}
          tooltip={isOpen ? undefined : tooltip}
          id={id}
          ref={triggerRef}
          padding={padding}
          isOpen={isOpen}
          hasSelection={!!selectedOptions.length}
          // Can be removed once #32325 is fixed (Button will then provide aria-disabled)
          aria-disabled={disabled}
          disabled={disabled}
          onClick={() => {
            if (isOpen) {
              handleClose();
            } else {
              setIsOpen(true);
            }
          }}
          tabIndex={isOpen ? -1 : 0}
          onKeyDown={handleButtonKeyDown}
          role={multiSelect ? 'combobox' : 'button'}
          aria-controls={isOpen ? listboxId : undefined}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          {!multiSelect && selectedOptions.length === 0 && (
            <>
              {icon}
              {children}
            </>
          )}
          {!multiSelect && !!selectedOptions.length && (
            <>
              {icon}
              {selectedOptions[0].title}
            </>
          )}

          {multiSelect && (
            <>
              {icon}
              {children}
              {!!selectedOptions.length && (
                <SelectedOptionCount
                  aria-label={`${selectedOptions.length} ${selectedOptions.length > 1 ? 'items' : 'item'} selected`}
                >
                  {selectedOptions?.length}
                </SelectedOptionCount>
              )}
            </>
          )}
        </StyledButton>
        {otState.isOpen && (
          <MinimalistPopover handleClose={handleClose} triggerRef={triggerRef}>
            <ScrollArea vertical>
              <Listbox
                aria-label={ariaLabel}
                role="listbox"
                id={listboxId}
                ref={listboxRef}
                aria-multiselectable={multiSelect}
                onKeyDown={handleListboxKeyDown}
              >
                {options.map((option) => (
                  <SelectOption
                    key={option.value ?? 'sb-reset'}
                    title={option.title}
                    description={option.description}
                    icon={option.icon}
                    id={valueToId(id, option)}
                    isActive={isOpen && activeOption?.value === option.value}
                    isSelected={
                      selectedOptions?.some((sel) => sel.value === option.value) ||
                      (selectedOptions.length === 0 && option === resetOption)
                    }
                    onClick={() => {
                      handleSelectOption(option);
                      if (!multiSelect) {
                        handleClose();
                      }
                    }}
                    onFocus={() => setActiveOption(option)}
                    shouldLookDisabled={
                      option === resetOption && selectedOptions.length === 0 && multiSelect
                    }
                    onKeyDown={(e: KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectOption(option);
                        if (!multiSelect) {
                          handleClose();
                        }
                      } else if (e.key === 'Tab') {
                        if (!multiSelect) {
                          handleSelectOption(option);
                        }
                        handleClose();
                      }
                    }}
                  >
                    {option.children}
                  </SelectOption>
                ))}
              </Listbox>
            </ScrollArea>
          </MinimalistPopover>
        )}
      </>
    );
  }
);

Select.displayName = 'Select';
