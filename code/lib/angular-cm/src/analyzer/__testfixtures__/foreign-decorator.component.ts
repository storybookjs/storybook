import { Component } from '@angular/core';

// Spelled `Input`, but it is not Angular's: matching on the decorator's name alone would document
// `tracked` as a bindable input.
import { Input } from './foreign-decorators';

@Component({ selector: 'sb-foreign-decorator', template: '' })
export class ForeignDecoratorComponent {
  @Input() tracked = 'no';
}
