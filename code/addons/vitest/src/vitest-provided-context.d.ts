import 'vitest';

declare module 'vitest' {
  interface ProvidedContext {
    'sb-config': Record<string, unknown>;
    'sb-ghost-stories': boolean;
  }
}
