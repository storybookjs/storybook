import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

@Pipe({
  standalone: false,
  name: 'customPipe',
})
export class CustomPipePipe implements PipeTransform {
  transform(value: any): any {
    return `CustomPipe: ${value}`;
  }
}
