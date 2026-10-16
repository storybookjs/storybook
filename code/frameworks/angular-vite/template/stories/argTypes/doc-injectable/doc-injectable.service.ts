import { Injectable } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';

/** This is an Angular Injectable example that has a Prop Table. */
@Injectable({
  providedIn: 'root',
})
export class DocInjectableService {
  /** Auth headers to use. */
  auth: any;

  constructor() {
    this.auth = new HttpHeaders({ 'Content-Type': 'application/json' });
  }

  /** Get posts from Backend. */
  getPosts(): unknown[] {
    return [];
  }
}
