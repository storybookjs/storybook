// ElementRef must be a regular import, not a type-only import, because it's used in dependency injection.
// Type-only imports are stripped during compilation, causing runtime errors like "ElementRef is not defined".
// Do not remove `Inject` even though it seems unused, it is used in the constructor.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Injector, ElementRef, Component, Input, InjectionToken, Inject } from '@angular/core';
import { stringify } from 'telejson';

export const TEST_TOKEN = new InjectionToken<string>('test');

@Component({
  standalone: false,
  selector: 'storybook-di-component',
  templateUrl: './di.component.html',
  providers: [{ provide: TEST_TOKEN, useValue: 123 }],
})
export class DiComponent {
  @Input()
  title?: string;

  constructor(
    protected injector: Injector,
    protected elRef: ElementRef,
    @Inject(TEST_TOKEN) protected testToken: number
  ) {}

  isAllDeps(): boolean {
    return Boolean(this.testToken && this.elRef && this.injector && this.title);
  }

  elRefStr(): string {
    return stringify(this.elRef, { maxDepth: 1 });
  }
}
