import type { InlineConfig } from 'vitest';

declare module 'vite' {
  interface UserConfig {
    /** Options for Vitest */
    test?: InlineConfig;
  }
}
