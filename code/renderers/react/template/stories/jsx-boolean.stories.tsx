import React from 'react';

interface ButtonProps {
  label: string;
  primary?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

// A minimal component with several boolean props to exercise the jsxDecorator
// source rendering. React.defaultProps is intentionally omitted, which is the
// pattern that previously caused `false` props to be silently dropped.
const Button = ({ label, primary = false, loading = false, disabled = false }: ButtonProps) => (
  <button
    className={primary ? 'storybook-button--primary' : 'storybook-button--secondary'}
    disabled={disabled}
    aria-busy={loading}
    type="button"
  >
    {label}
  </button>
);

export default {
  component: Button,
  tags: ['autodocs'],
};

// All boolean props set to false.
// Regression: with useBooleanShorthandSyntax: true (the old default), every
// explicit `false` prop was silently dropped from Show Code because the
// underlying library suppresses props whose value is `false` and have no
// matching React.defaultProps entry. After the fix the source must show:
//   <Button disabled={false} label="Submit" loading={false} />
export const BooleanFalseProps = {
  args: {
    label: 'Submit',
    primary: false,
    loading: false,
    disabled: false,
  },
};

// All boolean props set to true.
// With useBooleanShorthandSyntax: true (old default) these were shown as
// `primary loading disabled` (shorthand). After the fix the source must show
// explicit values: `primary={true} loading={true} disabled={true}`.
export const BooleanTrueProps = {
  args: {
    label: 'Submit',
    primary: true,
    loading: true,
    disabled: true,
  },
};

// Mixed true and false boolean props.
// Verifies that explicit rendering is consistent regardless of value.
export const BooleanMixedProps = {
  args: {
    label: 'Submit',
    primary: true,
    loading: false,
    disabled: false,
  },
};

// Per-story opt-in to the old shorthand syntax via parameters.jsx.
// When a story explicitly sets useBooleanShorthandSyntax: true, `true` props
// should use shorthand (`primary`) and `false` props should be omitted —
// preserving the opt-in escape hatch while the safe default is off.
export const BooleanShorthandOptIn = {
  args: {
    label: 'Submit',
    primary: true,
    loading: false,
    disabled: false,
  },
  parameters: {
    jsx: { useBooleanShorthandSyntax: true },
  },
};
