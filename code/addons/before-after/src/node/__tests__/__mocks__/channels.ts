// Minimal type-only stub for storybook/internal/channels. The addon's plugin
// only references the `Channel` type at compile-time.
export interface Channel {
  emit(event: string, payload?: unknown): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
}
