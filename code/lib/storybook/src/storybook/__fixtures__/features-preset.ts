/** A legacy `features` preset function that applies the flags from its addon options. */
export const features = async (
  existing: Record<string, boolean>,
  options: { flags: Record<string, boolean> }
): Promise<Record<string, boolean>> => ({ ...existing, ...options.flags });
