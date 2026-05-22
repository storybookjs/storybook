// Fixture: should fail ESLint with no-restricted-imports
// This file intentionally imports a forbidden node: built-in.
import { readFileSync } from 'node:fs';

export function dummy() {
  return readFileSync('/dev/null', 'utf8');
}
