/** Type guard to check if a value is defined. */
export const isDefined = <T>(value: T | undefined): value is T => value !== undefined;
