import { Component, Input } from '@angular/core';

export enum ButtonKind {
  Primary = 'primary',
  Secondary = 'secondary',
}

@Component({
  selector: 'sb-args-formatting',
  template: '<span>{{ label }}</span>',
})
export class ArgsFormattingComponent {
  @Input() label?: string;

  @Input() kind: ButtonKind = ButtonKind.Primary;

  @Input() offset = 0;

  @Input() data: Record<string, unknown> = {};

  @Input() tags: string[] = [];

  @Input() greeting = '';

  @Input() formatter: (value: string) => string = (value) => value;
}
