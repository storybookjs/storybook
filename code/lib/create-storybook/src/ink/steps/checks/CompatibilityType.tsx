export const CompatibilityType = {
  LOADING: 'loading' as const,
  IGNORED: 'ignored' as const,
  COMPATIBLE: 'compatible' as const,
  INCOMPATIBLE: 'incompatible' as const,
};

export type CompatibilityResult =
  | { type: typeof CompatibilityType.LOADING }
  | { type: typeof CompatibilityType.IGNORED }
  | { type: typeof CompatibilityType.COMPATIBLE }
  | { type: typeof CompatibilityType.INCOMPATIBLE; reasons: string[] };
