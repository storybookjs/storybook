import { Component, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'storybook-form',
  template: `
    <form id="interaction-test-form" (submit)="handleSubmit($event)">
  <label>
    Enter Value
    <input type="text" data-testid="value" [(ngModel)]="value" required />
  </label>
  <button type="submit">Submit</button>
  <p *ngIf="complete">Completed!!</p>
</form>
  `,
})
export default class FormComponent {
  /** Optional success handler */
  @Output()
  onSuccess = new EventEmitter<string>();

  value = '';

  complete = false;

  handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    this.onSuccess.emit(this.value);
    setTimeout(() => {
      this.complete = true;
    }, 500);
    setTimeout(() => {
      this.complete = false;
    }, 1500);
  }
}
