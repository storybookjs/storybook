import type { KeyboardEvent } from 'react';
import React, { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { ChevronDownIcon, ChevronUpIcon, RefreshIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import type { ButtonProps } from '../Button/Button';
import { Button } from '../Button/Button';
import { ScrollArea } from '../ScrollArea/ScrollArea';
import { WithTooltipPure } from '../tooltip/WithTooltip';
import { SelectOption } from './SelectOption';

export interface SelectOption {
  /** Optional rendering of the option. */
  children?: React.ReactNode;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  value: string;
}

interface ResetOption extends Omit<SelectOption, 'value'> {
  value: undefined;
}

const PAGE_STEP_SIZE = 5;

// TODO: @MichaelArestad, consider if we do want "reset on double click" as in some tools

// TODO: add story that shows that when opening a Select with a selected option, the reference index for
// all kb nav is the first selected option index, not 0.

export interface SelectProps extends Omit<ButtonProps, 'onClick' | 'onChange' | 'onSelect'> {
  size?: 'small' | 'medium';
  padding?: 'small' | 'medium' | 'none';
  variant?: 'outline' | 'solid' | 'ghost';
  disabled?: boolean;
  multiSelect?: boolean;

  options: SelectOption[];
  defaultOptions?: string | string[];
  defaultOpen?: boolean;

  onReset?: () => void;
  resetLabel?: string;

  onSelect?: (option: string) => void;
  onDeselect?: (option: string) => void;
  onChange?: (selected: string[]) => void;
}

function valueToId(parentId: string, { value }: ResetOption | SelectOption): string {
  return `${parentId}-opt-${value ?? 'sb-reset'}`;
}

const SelectedOptionLabel = styled('span')({
  appearance: 'none',
});

const SelectedOptionCount = styled('span')(({ theme }) => ({
  appearance: 'none',
  borderRadius: 20,
  padding: '2px 4px',
  fontSize: 11,
  background: theme.background.hoverable,
}));

const Listbox = styled('ul')({
  minWidth: 180,
  maxHeight: 504, // TODO: 60vh?
  borderRadius: 6,
  overflow: 'hidden auto',
  listStyle: 'none',
  margin: 0,
  padding: 4,
});

function setSelectedFromDefault(
  options: SelectProps['options'],
  defaultOptions: SelectProps['defaultOptions']
): SelectOption[] {
  if (!defaultOptions) {
    return [];
  }

  if (typeof defaultOptions === 'string') {
    return options.filter((opt) => opt.value === defaultOptions);
  }

  return options.filter((opt) => defaultOptions.some((def) => opt.value === def));
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      children,
      disabled = false,
      options: calleeOptions,
      defaultOptions,
      multiSelect = false,
      onReset,
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

    const id = useId();
    const listboxId = `${id}-listbox`;
    const listboxRef = useRef<HTMLUListElement>(null);

    const handleClose = useCallback(() => {
      setIsOpen(false);
      document.getElementById(id)?.focus();
    }, [id]);

    // The last selected option(s), which will be used by the app.
    const [selectedOptions, setSelectedOptions] = useState<SelectOption[]>(
      setSelectedFromDefault(calleeOptions, defaultOptions)
    );

    // Selects an option (updating the selection state based on multiSelect).
    const handleSelectOption = useCallback(
      (option: SelectOption | ResetOption) => {
        // Reset option case. We check value === undefined for cleaner type handling in the other branch.
        if (option.value === undefined) {
          onChange?.([]);
          onReset?.();
          setSelectedOptions([]);
        } else if (multiSelect) {
          setSelectedOptions((previous) => {
            let newSelected: SelectOption[] = [];

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
      [multiSelect, onChange, onSelect, onDeselect, onReset]
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
    const [activeOption, setActiveOptionState] = useState<SelectOption | ResetOption | undefined>(
      undefined
    );

    // In single select mode, the active option is the selected one, so we
    // wrap setActiveOption to handle selection. We never close the listbox
    // in that scenario.
    const setActiveOption = useCallback(
      (option: SelectOption | ResetOption) => {
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
        const listStart = resetOption && hasSelection ? 0 : 1;
        const listEnd = options.length - 1;

        // When we press ArrowUp/Down, we want to stay close to the edges rather than
        // initiate movement. When we press Home/End or PageUp/PageDown, we want to
        // move immediately because it's clearer the user intends to be in a specific
        // area of the list. This is why we don't always do +/- 1 but always do +/- PAGE_STEP_SIZE.
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
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
      <WithTooltipPure
        closeOnOutsideClick={true}
        visible={isOpen && !disabled}
        tooltip={
          <ScrollArea vertical>
            <Listbox
              role="listbox"
              id={listboxId}
              ref={listboxRef}
              aria-multiselectable={multiSelect}
              onKeyDown={(e) => {
                // We don't prevent default on Tab, so that the Tab or Shift+Tab goes
                // through after we've repositioned to the Button.
                if (e.key !== 'Tab') {
                  e.preventDefault();
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
              }}
            >
              {options.map((option) => (
                <SelectOption
                  key={option.value}
                  title={option.title}
                  description={option.description}
                  icon={option.icon}
                  id={valueToId(id, option)}
                  isActive={isOpen && activeOption?.value === option.value}
                  isSelected={selectedOptions?.some((sel) => sel.value === option.value)}
                  onClick={() => {
                    handleSelectOption(option);
                    if (!multiSelect) {
                      handleClose();
                    }
                  }}
                  onFocus={() => setActiveOption(option)}
                  shouldLookDisabled={option === resetOption && selectedOptions.length === 0}
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
        }
      >
        <Button
          {...props}
          ariaLabel={ariaLabel}
          tooltip={isOpen ? undefined : (tooltip ?? ariaLabel)}
          id={id}
          ref={ref}
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
          // FIXME We may want to switch to a select role for single select, especially if we don't do typeahead/autocomplete.
          role="combobox"
          aria-autocomplete="none"
          aria-expanded={isOpen}
          aria-controls={listboxId}
        >
          {/* SINGLE SELECT LABEL:
          TODO: decide if we want to:
          - always show the selected option
          - always show the original label
          - or have this controlled by a prop
          
          Based on that, craft aria-label to always have label + name or count of selected options.
          
          NOTE: by showing children, we let callees customise output freely (e.g. the theme picker)
          but that runs the risk of having a poor accessible name; ariaLabel could be made mandatory
          to counter that.
          */}

          {/* Option A: always show selected option */}
          {/*
          {(!multiSelect && selectedOptions.length === 0) && children}
          {!multiSelect && !!selectedOptions.length && (
            <SelectedOptionLabel>{selectedOptions[0].label}</SelectedOptionLabel>
          )}
          */}

          {/* Option B: always show label */}
          {!multiSelect && children}
          {!multiSelect && selectedOptions.length !== 0 && (
            <span className="sb-sr-only">currently selected: {selectedOptions[0].title}</span>
          )}

          {/* Option C needs to be coded if we go there. */}

          {/* TODO: once a decision was made re: how to display children, we must apply
           this select's `ariaLabel` prop TO THE CHILDREN and not to the component root,
           so that the computed accessible name retains the part below on current selection. */}

          {multiSelect && children}
          {multiSelect && !!selectedOptions.length && (
            <SelectedOptionCount
              aria-label={`${selectedOptions.length} ${selectedOptions.length > 1 ? 'items' : 'item'} selected`}
            >
              {selectedOptions?.length}
            </SelectedOptionCount>
          )}

          {/* TODO: decide if we want chevrons or not; it works poorly in the toolbar. */}
          {/* {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />} */}
        </Button>
      </WithTooltipPure>
    );
  }
);

Select.displayName = 'Select';
