import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  imports: [FormsModule],
  selector: 'storybook-form',
  template: `
    <form id="interaction-test-form" ngNativeValidate (submit)="handleSubmit($event)">
  <label>
    Enter Value
    <input type="text" data-testid="value" name="value" [(ngModel)]="value" required />
  </label>
  <button type="submit">Submit</button>
  @if (complete()) {
    <p>Completed!!</p>
  }
</form>
  `,
})
export default class FormComponent {
  /** Optional success handler */
  onSuccess = output<string>();

  value = '';

  complete = signal(false);

  handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    this.onSuccess.emit(this.value);
    setTimeout(() => {
      this.complete.set(true);
    }, 500);
    setTimeout(() => {
      this.complete.set(false);
    }, 1500);
  }
}
