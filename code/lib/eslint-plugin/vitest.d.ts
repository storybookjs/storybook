/// <reference types="vitest" />
import type { Assertion, AsymmetricMatchersContaining } from 'vitest'

declare module 'vitest' {
  interface CustomMatchers<R = unknown> {
    // Add any custom matchers here if needed
  }
}

interface Expect extends AsymmetricMatchersContaining {
  <T = unknown>(actual: T): Assertion<T>
}

declare global {
  const describe: (typeof import('vitest'))['describe']
  const expect: Expect
  const it: (typeof import('vitest'))['it']
  const beforeEach: (typeof import('vitest'))['beforeEach']
  const afterEach: (typeof import('vitest'))['afterEach']
}
