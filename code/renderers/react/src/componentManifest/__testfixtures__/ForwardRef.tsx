import { forwardRef } from 'react';

interface TextInputProps {
  /** Input label */
  label: string;
  /** Placeholder text */
  placeholder?: string;
  /** Change handler */
  onChange?: (value: string) => void;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(props, ref) {
    return null;
  }
);
