export {};

declare const globalThis: {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// TODO(9.0): We should actually wrap all those lines in `act`, but that might be a breaking change.
// We should make that breaking change for SB 9.0
export function preventActChecks(callback: () => void): void {
  const originalActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    callback();
  } finally {
    globalThis.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  }
}
