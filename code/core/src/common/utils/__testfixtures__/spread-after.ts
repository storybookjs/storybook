/**
 * Fixture: an unresolvable spread (a package the module resolver cannot reach) precedes a literal
 * `component`, which is the shape a shared config module composed from a base takes. The spread
 * cannot shadow a key written after it, so `component` must still resolve.
 */
import { ButtonComponent } from './button.component';
// @ts-expect-error - deliberately unresolvable, exercising the resolver's unreadable-spread path.
import { theme } from 'some-unresolvable-package-xyz';

export const config = { ...theme, component: ButtonComponent, args: {} };
