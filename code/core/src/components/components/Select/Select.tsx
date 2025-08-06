import type { KeyboardEvent } from 'react';
import React, { forwardRef, useCallback, useEffect, useId, useRef, useState } from 'react';

import { ChevronDownIcon, ChevronUpIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import type { ButtonProps } from '../Button/Button';
import { Button } from '../Button/Button';
import { ScrollArea } from '../ScrollArea/ScrollArea';
import { WithTooltipPure } from '../tooltip/WithTooltip';

export interface SelectOption {
  /** Optional rendering of the option. */
  children?: React.ReactNode;
  label: string;
  value: string;
}

const PAGE_STEP_SIZE = 5;

// TODO: add typeahead capability.
// TODO: add reset option, must be first, use optgroups maybe? skip it when 0 options are selected.
// TODO: ensure options can be disabled, but not skipped in kb nav

export interface SelectProps extends Omit<ButtonProps, 'onClick' | 'onChange' | 'onSelect'> {
  size?: 'small' | 'medium';
  padding?: 'small' | 'medium' | 'none';
  variant?: 'outline' | 'solid' | 'ghost';
  disabled?: boolean;
  multiSelect?: boolean;

  options: SelectOption[];
  defaultOptions?: string | string[];
  defaultOpen?: boolean;

  onSelect?: (option: SelectOption) => void;
  onDeselect?: (option: SelectOption) => void;
  onChange?: (selected: SelectOption[]) => void;
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

const Option = styled('li')<{ active: boolean }>(({ theme, active }) => ({
  padding: '6px 12px',
  background: active ? theme.background.hoverable : 'transparent',
  cursor: 'pointer',
  borderRadius: 4,
  '&[aria-selected="true"]': {
    fontWeight: theme.typography.weight.bold,
  },
  ':hover': {
    background: theme.background.hoverable,
  },
  ':focus-visible': {
    boxShadow: `inset 0 0 0 2px ${theme.color.ultraviolet}`,
    outline: 'none',
  },
}));

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      children,
      disabled = false,
      options,
      defaultOption,
      multiSelect = false,
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

    // The last selected option(s), which will be used by the app.
    const [selectedOptions, setSelectedOptions] = useState<SelectOption[]>(() => {
      if (!defaultOption) {
        return [];
      }

      if (typeof defaultOption === 'string') {
        return options.filter((opt) => opt.value === defaultOption);
      }

      return options.filter((opt) => defaultOption.some((def) => opt.value === def));
    });

    // The active option in the listbox, which will receive focus when the listbox is open.
    const [activeOption, setActiveOptionReact] = useState<SelectOption | undefined>(undefined);

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
              onDeselect?.(option);
              newSelected = previous?.filter((opt) => opt.value !== option.value) ?? [];
            } else {
              onSelect?.(option);
              newSelected = [...(previous ?? []), option];
            }

            onChange?.(newSelected);
            return newSelected;
          });
        } else {
          setSelectedOptions((current) => {
            if (current.every((opt) => opt.value !== option.value)) {
              onSelect?.(option);
              onChange?.([option]);
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

    const handleButtonOpen = useCallback(
      (defaultPos?: number) => {
        if (!activeOption && defaultPos !== undefined) {
          setActiveOption(options[defaultPos]);
        }
        setIsOpen(true);
      },
      [options, activeOption, setActiveOption]
    );

    const handleButtonKeyDown = useCallback(
      (e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setActiveOption(options[0]);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveOption(options[options.length - 1]);
        } else if (e.key === 'Home') {
          e.preventDefault();
          setActiveOption(options[0]);
        } else if (e.key === 'End') {
          e.preventDefault();
          setActiveOption(options[options.length - 1]);
        } else if (e.key === 'PageDown') {
          e.preventDefault();
          setActiveOption(options[Math.min(PAGE_STEP_SIZE, options.length - 1)]);
        } else if (e.key === 'PageUp') {
          e.preventDefault();
          setActiveOption(options[Math.max(0, options.length - 1 - PAGE_STEP_SIZE)]);
        }
        handleButtonOpen();
      },
      [options, handleButtonOpen, setActiveOption]
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
            >
              {options.map((option) => (
                <Option
                  key={option.value}
                  id={valueToId(id, option)}
                  role="option"
                  tabIndex={isOpen && activeOption?.value === option.value ? 0 : -1}
                  aria-selected={selectedOptions?.some((opt) => opt.value === option.value)}
                  active={activeOption?.value === option.value}
                  onClick={() => handleSelectOption(option, 'single-only')}
                  onFocus={() => setActiveOption(option)}
                  onKeyDown={(e) => {
                    // HWe don't prevent default on Tab, so that the Tab or Shift+Tab goes
                    // through after we've repositioned to the Button.
                    if (e.key !== 'Tab') {
                      e.preventDefault();
                    }

                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSelectOption(option, 'single-only');
                    } else if (e.key === 'Escape') {
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
                    } else if (e.key === 'Tab') {
                      // FIXME: for sure we dont want this in multi. probably also not in solo.
                      if (!multiSelect) {
                        handleSelectOption(option, 'always');
                      } else {
                        handleClose();
                      }
                    }
                  }}
                >
                  {option.children ?? option.label}
                </Option>
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
              handleButtonOpen();
            }
          }}
          tabIndex={isOpen ? -1 : 0}
          onKeyDown={handleButtonKeyDown}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
        >
          {/* SINGLE SELECT LABEL:
          TODO: decide if we want to:
          - always show the selected option
          - always show the original label
          - or have this controlled by a prop
          
          Based on that, craft aria-label to always have label + name or count of selected options */}

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
            <span className="sb-sr-only">currently selected: {selectedOptions[0].label}</span>
          )}

          {/* Option C needs to be coded if we go there. */}

          {multiSelect && children}
          {multiSelect && !!selectedOptions.length && (
            <SelectedOptionCount aria-label={`${selectedOptions.length} items selected`}>
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
