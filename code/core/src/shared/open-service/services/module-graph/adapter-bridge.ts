import type { ChangeDetectionAdapter } from './engine/adapters/types.ts';

let resolveAdapter!: (adapter: ChangeDetectionAdapter) => void;

/**
 * Resolved by {@link provideChangeDetectionAdapter} once the preview builder is up.
 * The engine awaits this before building the graph — not at open-service registration time.
 */
export const changeDetectionAdapterPromise = new Promise<ChangeDetectionAdapter>((resolve) => {
  resolveAdapter = resolve;
});

export function provideChangeDetectionAdapter(adapter: ChangeDetectionAdapter): void {
  resolveAdapter(adapter);
}
