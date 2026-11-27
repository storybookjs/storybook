/** The props of a merged component. */
export interface Merged {
  label: string;
}

/** A component that shares its name with a type. */
export const Merged = (props: Merged) => props.label;
