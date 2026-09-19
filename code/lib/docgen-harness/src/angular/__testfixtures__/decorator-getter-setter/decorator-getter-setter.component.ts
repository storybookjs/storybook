import { Component, Input } from '@angular/core';

@Component({
  selector: 'sb-decorator-getter-setter',
  template: '<span>{{ volume }}</span>',
})
export class DecoratorGetterSetterComponent {
  private innerVolume = 5;

  /** Playback volume, clamped between 0 and 10. */
  @Input()
  get volume(): number {
    return this.innerVolume;
  }
  set volume(value: number) {
    this.innerVolume = Math.min(10, Math.max(0, value));
  }
}
