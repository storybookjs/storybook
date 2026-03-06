import type { Provider } from '@angular/core';
import { InjectionToken, NgZone } from '@angular/core';
import type { Subject, Subscriber } from 'rxjs';
import { Observable } from 'rxjs';

import type { ICollection } from '../types';

export const STORY_PROPS = new InjectionToken<Subject<ICollection | undefined>>('STORY_PROPS');

export const storyPropsProvider = (storyProps$: Subject<ICollection | undefined>): Provider => ({
  provide: STORY_PROPS,
  useFactory: storyDataFactory(storyProps$.asObservable()),
  deps: [NgZone],
});

function storyDataFactory<T>(data: Observable<T>) {
  return (ngZone: NgZone) =>
    new Observable((subscriber: Subscriber<T>) => {
      const sub = data.subscribe(
        (v: T) => {
          ngZone.run(() => subscriber.next(v));
        },
        (err) => {
          ngZone.run(() => subscriber.error(err));
        },
        () => {
          ngZone.run(() => subscriber.complete());
        }
      );

      return () => {
        sub.unsubscribe();
      };
    });
}
