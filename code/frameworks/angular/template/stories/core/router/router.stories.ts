import { Meta, StoryObj, applicationConfig, moduleMetadata } from '@storybook/angular';
import { RouterModule } from '@angular/router';
import { Component } from '@angular/core';
import ProvideRouterComponent from './router-component/router-component';

@Component({
  template: ` <div>
  <span>Empty Component works!</span>
  <a routerLink="/home">Home</a>
</div>`,
})
class EmptyComponent {}

const meta: Meta<ProvideRouterComponent> = {
  component: ProvideRouterComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [RouterModule],
    }),
    applicationConfig({
      routing: {
        routes: [
          { path: '', redirectTo: '/home', pathMatch: 'full' },
          { path: 'home', component: ProvideRouterComponent },
          { path: '**', component: EmptyComponent },
        ],
        options: {
          useHash: true,
        },
      },
    }),
  ],
  parameters: {
    useTestBedRenderer: true,
  },
  render: (args) => {
    return {
      template: `
        <div>
          <router-outlet></router-outlet>
        </div>`,
    };
  },
};

export default meta;

type Story = StoryObj<ProvideRouterComponent>;

export const ProvideRouterWithoutArgs: Story = {};
