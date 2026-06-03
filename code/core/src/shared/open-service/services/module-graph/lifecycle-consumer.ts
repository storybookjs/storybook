/** Optional hooks from {@link ChangeDetectionService} (or similar) wired at dev-server startup. */
export type ModuleGraphLifecycleConsumer = {
  onReady?: () => void;
  onChange?: () => void;
  onError?: (error: Error) => void;
  onUnavailable?: (reason: string, error?: Error) => void;
};

let consumer: ModuleGraphLifecycleConsumer | undefined;

export function registerModuleGraphLifecycleConsumer(
  next: ModuleGraphLifecycleConsumer | undefined
): void {
  consumer = next;
}

export function getModuleGraphLifecycleConsumer(): ModuleGraphLifecycleConsumer | undefined {
  return consumer;
}
