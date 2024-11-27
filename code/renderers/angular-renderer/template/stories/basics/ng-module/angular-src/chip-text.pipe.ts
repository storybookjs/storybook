import { PipeTransform, Pipe } from '@angular/core';

@Pipe({
  standalone: false,
  name: 'chipText',
})
export class ChipTextPipe implements PipeTransform {
  transform(value: string): string {
    return Array.from(value)
      .map((char) => this.accentVowel(char))
      .join('');
  }

  accentVowel(char: string): string {
    switch (char) {
      case 'a':
        return 'á';
      case 'e':
        return 'é';
      case 'i':
        return 'í';
      case 'o':
        return 'ó';
      case 'u':
        return 'ú';
      default:
        return char;
    }
  }
}
