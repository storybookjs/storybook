/**
 * Fixture: spreads a config object from `shared2`, and separately imports a same-named class from
 * `legacy/button` under the identical local name `ButtonComponent`. A resolver that re-resolves the
 * spread-copied `component` identifier against this module's imports, instead of the module that
 * wrote it, picks the wrong class.
 */
import { ButtonComponent } from './legacy/button';
import { base } from './shared2';

export const other = ButtonComponent;
export const config = { ...base, args: {} };
