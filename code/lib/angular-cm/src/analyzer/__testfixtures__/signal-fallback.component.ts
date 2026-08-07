// @ts-nocheck
// Deliberately imports nothing: every identifier below is unresolved, exercising the analyzer's
// bare-name signal fallback for projects whose `@angular/core` types are unreachable.

@Component({
  selector: 'sb-signal-fallback',
  template: '',
})
export class SignalFallbackComponent {
  label = input('hi');

  count = input.required<number>();

  step = input(2, { alias: 'increment' });

  toggled = output<boolean>();

  value = model(1);

  notSignal = compute('x');
}
