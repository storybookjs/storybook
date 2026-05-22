// Fixture (C6 bypass-attempt): should fail ESLint with no-restricted-syntax.
// Tries to reach child_process via process.mainModule.require — caught by the
// process.mainModule + member-access require selectors.
import { test } from './_util.ts';

test('attempt to load child_process via process.mainModule', () => {
  // @ts-expect-error - process.mainModule is non-null at runtime in Node.
  const cp = process.mainModule.require('child_process');
  cp.execSync('echo pwned');
});
