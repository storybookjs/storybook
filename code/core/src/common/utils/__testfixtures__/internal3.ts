/**
 * Fixture: spreads a config object from `shared2` without importing any class under a colliding
 * local name. A resolver that re-resolves the spread-copied `component` identifier against this
 * module's imports finds no such import at all, and reports a path to a file that never mentions
 * the class.
 */
import { base } from './shared2';

export const config = { ...base, args: {} };
