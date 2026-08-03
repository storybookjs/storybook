Create an accessible `ToggleSwitch` component with props `label: string`, `checked?: boolean`, `onChange?: (checked: boolean) => void`, and `disabled?: boolean`, exported from `src/components/ToggleSwitch.tsx`. Requirements:

- Use `role="switch"` and keep `aria-checked` and `aria-disabled` in sync with state.
- Keyboard: toggle on Space or Enter; do nothing when disabled.
- Add `data-testid="toggle-switch"` on the interactive element and `data-testid="toggle-label"` on the label.
- Minimal styling is fine; make on/off states visually distinct.
