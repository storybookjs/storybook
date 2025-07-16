import type { ButtonHTMLAttributes, KeyboardEvent } from 'react';
import React, { forwardRef, useCallback, useEffect, useId, useRef, useState } from 'react';

import { ChevronDownIcon, ChevronUpIcon } from '@storybook/icons';

import { styled } from 'storybook/theming';

import { Button } from '../Button/Button';
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

    // The active descendant in the listbox, which is presented to assistive technologies as having focus.
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
        if (nextIndex >= options.length && currentIndex === options.length - 1) {
          setActiveOption(options[0]);
        } else {
          setActiveOption(options[Math.min(options.length - 1, nextIndex)]);
        }
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
        if (nextIndex < 0 && currentIndex === 0) {
          setActiveOption(options[options.length - 1]);
        } else {
          setActiveOption(options[Math.max(0, nextIndex)]);
        }
      },
      [isOpen, activeOption, options]
    );

    const handleSelectOption = useCallback((option: OptionProps) => {
      setSelectedOption(option);
      setIsOpen(false);
    }, []);

    const openWithDefaultPosition = useCallback(
      (defaultPos: number) => {
        setIsOpen(true);
        if (!activeOption) {
          setActiveOption(options[defaultPos]);
        }
      },
      [activeOption, options]
    );

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          if (!isOpen) {
            openWithDefaultPosition(0);
          } else {
            moveActiveOptionDown();
          }
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          if (!isOpen) {
            openWithDefaultPosition(options.length - 1);
          } else {
            moveActiveOptionUp();
          }
        } else if (event.key === 'PageDown' && isOpen) {
          event.preventDefault();
          moveActiveOptionDown(5);
        } else if (event.key === 'PageUp' && isOpen) {
          event.preventDefault();
          moveActiveOptionUp(5);
        } else if (event.key === 'Home' && isOpen) {
          event.preventDefault();
          setActiveOption(options[0]);
        } else if (event.key === 'End' && isOpen) {
          event.preventDefault();
          setActiveOption(options[options.length - 1]);
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (isOpen && activeOption) {
            handleSelectOption(activeOption);
          } else {
            openWithDefaultPosition(0);
          }
        } else if (event.key === 'Escape') {
          setIsOpen(false);
        }
      },
      [
        isOpen,
        activeOption,
        options,
        handleSelectOption,
        moveActiveOptionDown,
        moveActiveOptionUp,
        openWithDefaultPosition,
      ]
    );

    // TODO: Implement a-z typing.
    // TODO: Add scrollable area to listbox.
    // TODO: Ensure we close up when focus is transferred outside the button & listbox.

    useEffect(() => {
      if (isOpen && activeOption) {
        document.getElementById(valueToId(id, activeOption))?.scrollIntoView({ block: 'nearest' });
      }
    }, [isOpen, activeOption, id]);

    return (
      <WithTooltipPure
        visible={isOpen && !disabled}
        tooltip={
          <div role="listbox" id={listboxId} ref={listboxRef}>
            {options.map((option) => (
              <Option
                key={option.value}
                id={valueToId(id, option)}
                role="option"
                aria-selected={selectedOption?.value === option.value}
                active={activeOption?.value === option.value}
                onClick={() => handleSelectOption(option)}
                onMouseEnter={() => setActiveOption(option)}
              >
                {option.children ?? option.label}
              </Option>
            ))}
          </div>
        }
      >
        <Button
          {...props}
          id={id}
          ref={ref}
          disabled={disabled}
          onClick={() => {
            if (!isOpen) {
              openWithDefaultPosition(0);
            } else {
              setIsOpen(false);
            }
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={isOpen}
          aria-activedescendant={isOpen && activeOption ? valueToId(id, activeOption) : undefined}
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
