import { Component, ContentChild, ElementRef, ViewChild } from '@angular/core';

@Component({ selector: 'sb-member-identity', template: '' })
export class MemberIdentityComponent {
  @ViewChild('asProperty') asProperty!: ElementRef;

  @ViewChild('asSetter')
  set asSetter(value: ElementRef) {
    this.captured = value;
  }

  @ContentChild('asGetter')
  get asGetter(): ElementRef {
    return this.captured;
  }

  captured!: ElementRef;

  constructor(
    public pageSize: number,
    readonly pageIndex: number,
    private hidden: number,
    /** @deprecated use pageSize */
    public legacySize: number
  ) {}

  static create(): string {
    return '';
  }

  create(): number {
    return 0;
  }

  static get mode(): string {
    return 'static';
  }

  get mode(): number {
    return 1;
  }
}
