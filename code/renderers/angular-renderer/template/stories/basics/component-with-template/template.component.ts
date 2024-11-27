import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-template',
  imports: [CommonModule],
  template: `<div (click)="event($event)">
  Label: {{ label }}
  <br />
  Label2: {{ label2 }}
  <br />
  <button (click)="inc()">+</button>
</div>`,
  styles: [],
  standalone: true,
})
export class Template {
  @Input() label = 'default label';

  @Input() label2 = 'default label2';

  @Output() changed = new EventEmitter<string>();

  inc() {
    this.changed.emit('Increase');
  }
}
