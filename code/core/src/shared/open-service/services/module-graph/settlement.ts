let whenSettled: () => Promise<void> = () => Promise.resolve();

/** Wired by {@link registerModuleGraphService} so query `load` hooks can await graph build completion. */
export function setModuleGraphWhenSettled(fn: () => Promise<void>): void {
  whenSettled = fn;
}

export function moduleGraphWhenSettled(): Promise<void> {
  return whenSettled();
}

export function resetModuleGraphWhenSettled(): void {
  whenSettled = () => Promise.resolve();
}
