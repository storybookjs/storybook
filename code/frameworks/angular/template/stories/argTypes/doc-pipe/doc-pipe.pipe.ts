import { PipeTransform, Pipe } from '@angular/core';

/** This is an Angular Pipe example that has a Prop Table. */
@Pipe({
  name: 'docPipe',
})
export class DocPipe implements PipeTransform {
  /**
   * Transforms a string into uppercase.
   *
   * @param value String
   */
  transform(value: string): string {
    return value?.toUpperCase();
  }
}
