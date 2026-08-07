import { Injectable, NgModule, Pipe } from '@angular/core';

/** Formats things. */
@Pipe({ name: 'sbFormat' })
export class FormatPipe {
  transform(value: string, width?: number): string {
    return value.padEnd(width ?? 0);
  }
}

@Injectable()
export class DataService {
  rows = 3;

  load(id: number): Promise<string[]> {
    return Promise.resolve([`${id}`]);
  }
}

export class Paginator {
  page = 1;

  constructor(
    public pageSize: number,
    label?: string
  ) {
    void label;
  }

  next(): void {
    this.page += 1;
  }
}

@NgModule({})
export class NoiseModule {}
