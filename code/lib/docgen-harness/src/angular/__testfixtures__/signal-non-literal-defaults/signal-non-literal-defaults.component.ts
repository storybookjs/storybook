import { Component, input } from '@angular/core';

function makeDefault(): number {
  return 42;
}

@Component({
  selector: 'sb-signal-non-literal-defaults',
  template: '<span>{{ list() }} {{ computed() }} {{ config() }} {{ requiredValue() }}</span>',
})
export class SignalNonLiteralDefaultsComponent {
  list = input([1, 2, 3]);

  computed = input(makeDefault());

  config = input({ a: 1 });

  requiredValue = input.required();
}
