export const isReduceMotionEnabled = () => {
  if (!globalThis?.matchMedia) {
    return false;
  }
  const prefersReduceMotion = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
  return !!prefersReduceMotion?.matches;
};
