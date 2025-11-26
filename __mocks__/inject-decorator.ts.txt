import { Component } from '@angular/core';
import { Store, StoreModule } from '@ngrx/store';
import { storiesOf, moduleMetadata } from '@storybook/angular';

@Component({
  selector: 'storybook-comp-with-store',
  template: '<div>{{this.getStoreState()}}</div>',
})
class WithStoreComponent {
  private store: Store<any>;

  constructor(store: Store<any>) {
    this.store = store;
  }

  getStoreState(): string {
    return this.store === undefined ? 'Store is NOT injected' : 'Store is injected';
  }
}

storiesOf('ngrx|Store', module)
  .addDecorator(
    moduleMetadata({
      imports: [StoreModule.forRoot({})],
      declarations: [WithStoreComponent],
    })
  )
  .add('With component', () => {
    return {
      component: WithStoreComponent,
    };
  });