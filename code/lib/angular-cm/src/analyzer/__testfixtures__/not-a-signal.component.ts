import { Component } from '@angular/core';

function input(value: string): string {
  return value;
}

@Component({
  selector: 'sb-not-a-signal',
  template: '',
})
export class NotASignalComponent {
  label = input('hi');
}
