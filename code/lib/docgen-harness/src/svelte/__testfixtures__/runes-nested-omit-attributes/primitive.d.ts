// Shaped like bits-ui's `Checkbox.RootProps`: the component's own props and the button attributes,
// each through an `Omit`.
import type { HTMLButtonAttributes } from 'svelte/elements';

type Primitive<T> = Omit<T, 'style' | 'id' | 'children'> & { id?: string };

type CheckboxRootPropsWithoutHTML = {
  /** Checked state. */
  checked?: boolean;
  /** Called when the checked state changes. */
  onCheckedChange?: (checked: boolean) => void;
  /** Element reference. */
  ref?: HTMLElement | null;
};

export type CheckboxRootProps = CheckboxRootPropsWithoutHTML &
  Omit<Primitive<HTMLButtonAttributes>, keyof CheckboxRootPropsWithoutHTML>;
