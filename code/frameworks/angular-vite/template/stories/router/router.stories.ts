import { Component } from '@angular/core';
import { RouterLink, RouterOutlet, provideRouter, withHashLocation } from '@angular/router';

import type { Meta, StoryObj } from '@storybook/angular-vite';
import { applicationConfig, moduleMetadata } from '@storybook/angular-vite';

import ProvideRouterComponent from './router-component/router-component';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <div>
      <span>Empty Component works!</span>
      <a routerLink="/home">Home</a>
    </div>
  `,
})
class EmptyComponent {}

const meta: Meta<ProvideRouterComponent> = {
  component: ProvideRouterComponent,
  tags: ['autodocs'],
  decorators: [
    moduleMetadata({
      imports: [RouterOutlet],
    }),
    applicationConfig({
      providers: [
        provideRouter(
          [
            { path: '', redirectTo: '/home', pathMatch: 'full' },
            { path: 'home', component: ProvideRouterComponent },
            { path: '**', component: EmptyComponent },
          ],
          withHashLocation()
        ),
      ],
    }),
  ],
  render: () => {
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
