import type { ButtonHTMLAttributes, KeyboardEvent } from 'react';
import React, { forwardRef, useCallback, useEffect, useId, useRef, useState } from 'react';

import { ChevronDownIcon, ChevronUpIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import { Button } from '../Button/Button';
import { ScrollArea } from '../ScrollArea/ScrollArea';
import { WithTooltipPure } from '../tooltip/WithTooltip';

export interface OptionProps {
  children?: React.ReactNode;
  label: string;
  value: string;
}

export interface SelectProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'small' | 'medium';
  padding?: 'small' | 'medium' | 'none';
  variant?: 'outline' | 'solid' | 'ghost';
  disabled?: boolean;

  options: OptionProps[];
  defaultOption?: string;
  defaultOpen?: boolean;
}

function valueToId(parentId: string, { value }: { value: string }): string {
  return `${parentId}-opt-${value}`;
}

const SelectedOptionLabel = styled('span')({
  appearance: 'none',
});

const Listbox = styled('div')({
  maxHeight: '60vh',
});

const Option = styled('div')<{ active: boolean }>(({ theme, active }) => ({
  padding: '6px 12px',
  background: active ? theme.background.hoverable : 'transparent',
  cursor: 'pointer',
  borderRadius: 4,
  '&[aria-selected="true"]': {
    fontWeight: theme.typography.weight.bold,
  },
}));

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  ({ children, disabled = false, options, defaultOption, ...props }, ref) => {
    const [isOpen, setIsOpen] = useState(props.defaultOpen || false);

    const id = useId();
    const listboxId = `${id}-listbox`;
    const listboxRef = useRef<HTMLDivElement>(null);

    // The last selected option, which will be used by the app.
    const [selectedOption, setSelectedOption] = useState<OptionProps | undefined>(() =>
      options.find((o) => o.value === defaultOption)
    );

    // The active option in the listbox, which will receive focus when the listbox is open.
    const [activeOption, setActiveOption] = useState<OptionProps | undefined>(undefined);

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
      [isOpen, activeOption, options]
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
      [isOpen, activeOption, options]
    );

    const handleOpen = useCallback(
      (defaultPos: number) => {
        if (!activeOption) {
          setActiveOption(options[defaultPos]);
        }
        setIsOpen(true);
      },
      [options, activeOption]
    );

    const handleClose = useCallback(() => {
      setIsOpen(false);
      document.getElementById(id)?.focus();
    }, [id]);

    const handleSelectOption = useCallback(
      (option: OptionProps) => {
        setSelectedOption(option);
        handleClose();
      },
      [handleClose]
    );

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleOpen(0);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          handleOpen(options.length - 1);
        }
      },
      [options, handleOpen]
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

    // TODO: Implement a-z typing.

    return (
      <WithTooltipPure
        closeOnOutsideClick={true}
        visible={isOpen && !disabled}
        onVisibleChange={(newVisible) => {
          if (!newVisible) {
            handleClose();
          }
        }}
        tooltip={
          <ScrollArea vertical>
            <Listbox role="listbox" id={listboxId} ref={listboxRef}>
              {options.map((option) => (
                <Option
                  key={option.value}
                  id={valueToId(id, option)}
                  role="option"
                  tabIndex={isOpen && activeOption?.value === option.value ? 0 : -1}
                  aria-selected={selectedOption?.value === option.value}
                  active={activeOption?.value === option.value}
                  onClick={() => handleSelectOption(option)}
                  onMouseEnter={() => setActiveOption(option)}
                  onFocus={() => setActiveOption(option)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectOption(option);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleClose();
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      moveActiveOptionDown();
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      moveActiveOptionUp();
                    } else if (e.key === 'Home') {
                      e.preventDefault();
                      setActiveOption(options[0]);
                    } else if (e.key === 'End') {
                      e.preventDefault();
                      setActiveOption(options[options.length - 1]);
                    } else if (e.key === 'PageDown') {
                      e.preventDefault();
                      moveActiveOptionDown(5);
                    } else if (e.key === 'PageUp') {
                      e.preventDefault();
                      moveActiveOptionUp(5);
                    } else if (e.key === 'Tab') {
                      handleSelectOption(option);
                      // Here, we don't prevent default, so that the Tab or Shift+Tab goes
                      // through after we've repositioned to the Button.
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
              handleOpen(0);
            }
          }}
          tabIndex={isOpen ? -1 : 0}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
        >
          {children}

          {selectedOption && <SelectedOptionLabel>{selectedOption.label}</SelectedOptionLabel>}

          {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </Button>
      </WithTooltipPure>
    );
  }
);

Select.displayName = 'Select';
