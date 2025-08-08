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

const RESET_VALUE = '__sb_internal_reset';
const PAGE_STEP_SIZE = 5;

// TODO: add typeahead capability.
// TODO: consider if we do want "reset on double click" as in some tools
// TODO: ensure options can be disabled, but not skipped in kb nav
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

function valueToId(parentId: string, { value }: { value: string }): string {
  return `${parentId}-opt-${value}`;
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
  maxHeight: '60vh',
  listStyle: 'none',
  margin: 0,
  padding: 0,
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

    // Selects an option (updating the selection state based on multiSelect) and decides whether to close the listbox.
    const handleSelectOption = useCallback(
      (option: SelectOption, close: 'always' | 'single-only' | 'never') => {
        if (multiSelect) {
          setSelectedOptions((previous) => {
            let newSelected: SelectOption[];

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

        if (close === 'always' || (close === 'single-only' && !multiSelect)) {
          handleClose();
        }
      },
      [handleClose, multiSelect, onChange, onSelect, onDeselect]
    );

    const options = useMemo(() => {
      const opts = calleeOptions.map((option) => ({
        ...option,
        onClick: () => handleSelectOption(option, 'single-only'),
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelectOption(option, 'single-only');
          } else if (e.key === 'Tab') {
            // FIXME: for sure we dont want this in multi. probably also not in solo.
            if (!multiSelect) {
              handleSelectOption(option, 'always');
            } else {
              handleClose();
            }
          }
        },
      }));

      if (onReset) {
        opts.unshift({
          value: RESET_VALUE,
          title: resetLabel ?? 'Reset selection',
          icon: <RefreshIcon />,
          onClick: () => {
            onReset();
            handleClose();
          },
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onReset();
              handleClose();
            } else if (e.key === 'Tab') {
              handleClose();
            }
          },
        });
      }

      return opts;
    }, [calleeOptions, onReset, resetLabel, multiSelect, handleClose, handleSelectOption]);

    // The last selected option(s), which will be used by the app.
    const [selectedOptions, setSelectedOptions] = useState<SelectOption[]>(
      setSelectedFromDefault(options, defaultOptions)
    );

    // We must do this to account for callees that have an unstable data model.
    // For instance, when a URL query param is passed for the theme addon, the
    // addon receives, undefined, then the default theme value (incorrectly),
    // then the actual URL query param as a selected theme.
    useEffect(() => {
      if (defaultOptions) {
        setSelectedOptions(setSelectedFromDefault(options, defaultOptions));
      }
    }, [defaultOptions, options]);

    // The active option in the listbox, which will receive focus when the listbox is open.
    const [activeOption, setActiveOptionReact] = useState<SelectOption | undefined>(undefined);

    // In single select mode, the active option is the selected one, so we
    // wrap setActiveOption to handle selection. We never close the listbox
    // in that scenario.
    const setActiveOption = useCallback(
      (option: SelectOption) => {
        setActiveOptionReact(option);
        if (!multiSelect) {
          handleSelectOption(option, 'never');
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

        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          openAt(0);
        } else if (e.key === 'ArrowUp') {
          openAt(options.length - 1);
        } else if (e.key === 'Home') {
          openAt(0);
        } else if (e.key === 'End') {
          openAt(options.length - 1);
        } else if (e.key === 'PageDown') {
          openAt(Math.min(PAGE_STEP_SIZE, options.length - 1));
        } else if (e.key === 'PageUp') {
          openAt(Math.max(0, options.length - 1 - PAGE_STEP_SIZE));
        }
      },
      [options, setActiveOption]
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
        onVisibleChange={(newVisible) => {
          // FIXME: this gets called by WithTooltip every time we blur, which
          // is not compatible with a roving tabindex kb nav. Need to fix it
          // on the parent component.
          if (!newVisible) {
            handleClose();
          }
        }}
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
                  onClick={option.onClick}
                  onKeyDown={option.onKeyDown}
                  onFocus={() => setActiveOption(option)}
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
