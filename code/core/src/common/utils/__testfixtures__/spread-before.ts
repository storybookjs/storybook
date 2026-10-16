/**
 * Fixture: the mirror of `spread-after`. The unresolvable spread runs after `component`, so it may
 * still overwrite it at runtime, and the chain must stay unresolved.
 */
import { ButtonComponent } from './button.component';
// @ts-expect-error - deliberately unresolvable, exercising the resolver's unreadable-spread path.
import { theme } from 'some-unresolvable-package-xyz';

export const config = { component: ButtonComponent, ...theme, args: {} };
