import { Component } from '@angular/core';
import { RouterLink, RouterOutlet, provideRouter, withHashLocation } from '@angular/router';

import type { Meta, StoryObj } from '@storybook/angular-vite';
import { applicationConfig, moduleMetadata } from '@storybook/angular-vite';

import { expect, within } from 'storybook/test';

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

@Component({
  standalone: true,
  template: `<span>Second route from the hash</span>`,
})
class SecondRouteComponent {}

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
            { path: 'second', component: SecondRouteComponent },
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

export const RoutesFromTheRealLocationHash: Story = {
  beforeEach: () => {
    window.location.hash = '#/second';
    return () => {
      window.location.hash = '';
    };
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText('Second route from the hash')
    ).toBeInTheDocument();
  },
};
