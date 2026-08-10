import { Component, input } from '@angular/core';

// Only the constant is imported, never the type, so the checker renders the inferred type with an
// `import("...")` qualifier that has to be stripped before it can match the indexed alias.
import { DEFAULT_THEME } from './signal-alias-types';

@Component({ selector: 'sb-signal-alias', template: '' })
export class SignalAliasComponent {
  theme = input(DEFAULT_THEME);
}
