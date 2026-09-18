export interface ButtonProps {
  label: string;
  count: number;
  disabled: boolean;
  onClick: () => void;
}

// Flat-prop shape: primitives plus a function prop — the serializer's easy case.
export function Button({ label, count, disabled, onClick }: ButtonProps) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}>
      {label} — count {count}
    </button>
  );
}
