import { OnInit, Type, Component, Injector, Input } from '@angular/core';
import { Meta, componentWrapperDecorator, moduleMetadata, StoryObj } from '@storybook/angular';
import { WithoutSelectorComponent, WITHOUT_SELECTOR_DATA } from './without-selector.component';

const meta: Meta<WithoutSelectorComponent> = {
  // title: 'Basics / Component / without selector / Custom wrapper *NgComponentOutlet',
  component: WithoutSelectorComponent,
  decorators: [
    moduleMetadata({
      entryComponents: [WithoutSelectorComponent],
    }),
  ],
} as Meta;

export default meta;

type Story = StoryObj<WithoutSelectorComponent>;

// Advanced example with custom *ngComponentOutlet

@Component({
  standalone: false,
  selector: 'ng-component-outlet-wrapper',
  template: `<ng-container
  *ngComponentOutlet="componentOutlet; injector: componentInjector; content: componentContent"
></ng-container>`,
})
class NgComponentOutletWrapperComponent implements OnInit {
  @Input()
  componentOutlet?: Type<unknown>;

  @Input()
  name?: string;

  @Input()
  color?: string;

  componentInjector?: Injector;

  componentContent = [
    [document.createTextNode('Ng-content : Inspired by ')],
    [document.createTextNode('https://angular.io/api/common/NgComponentOutlet')],
  ];

  constructor(private readonly injector: Injector) {}

  ngOnInit(): void {
    this.componentInjector = Injector.create({
      providers: [
        { provide: WITHOUT_SELECTOR_DATA, useValue: { color: this.color, name: this.name } },
      ],
      parent: this.injector,
    });
  }
}

// Live changing of args by controls does not work at the moment. When changing args storybook does not fully
// reload and therefore does not take into account the change of provider.
export const WithCustomNgComponentOutletWrapper: Story = {
  name: 'Custom wrapper *NgComponentOutlet',
  argTypes: {
    name: { control: 'text' },
    color: { control: 'color' },
  },
  args: { name: 'Color', color: 'green' },
  decorators: [
    moduleMetadata({
      declarations: [NgComponentOutletWrapperComponent],
    }),
    componentWrapperDecorator(NgComponentOutletWrapperComponent, (args) => ({
      name: args.name,

      color: args['color'],
      componentOutlet: WithoutSelectorComponent,
    })),
  ],
};
