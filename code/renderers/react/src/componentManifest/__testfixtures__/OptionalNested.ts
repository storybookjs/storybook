interface OptionalNestedProps {
  /** A simple optional string */
  name?: string;
  /** Optional record with nested undefined in the value type */
  config?: Record<string, number | undefined>;
  /** Optional callback with undefined in parameter type */
  onChange?: (value: string | undefined) => void;
  /** Required prop for contrast */
  id: number;
}
export function OptionalNested(props: OptionalNestedProps) {
  return null;
}
