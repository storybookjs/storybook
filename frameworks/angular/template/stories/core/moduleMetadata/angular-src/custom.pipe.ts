import { PipeTransform, Pipe } from '@angular/core';

@Pipe({
  standalone: false,
  name: 'customPipe',
})
export class CustomPipePipe implements PipeTransform {
  transform(value: any, args?: any): any {
    return `CustomPipe: ${value}`;
  }
}
