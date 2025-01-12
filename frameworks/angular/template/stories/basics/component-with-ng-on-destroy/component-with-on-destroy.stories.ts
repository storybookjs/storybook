import { OnDestroy, OnInit, Component } from '@angular/core';
import { Meta, StoryObj } from '@storybook/angular';

@Component({
  standalone: false,
  selector: 'on-destroy',
  template: `Current time: {{ time }} <br />
📝 The current time in console should no longer display after a change of story`,
})
class OnDestroyComponent implements OnInit, OnDestroy {
  time?: string;

  interval: any;

  ngOnInit(): void {
    const myTimer = () => {
      const d = new Date();
      this.time = d.toLocaleTimeString();
      console.info(`Current time: ${this.time}`);
    };

    myTimer();
    this.interval = setInterval(myTimer, 3000);
  }

  ngOnDestroy(): void {
    clearInterval(this.interval);
  }
}

const meta: Meta<OnDestroyComponent> = {
  // title: 'Basics / Component / with ngOnDestroy',
  component: OnDestroyComponent,
  parameters: {
    // disabled due to new Date()
    chromatic: { disable: true },
  },
} as Meta;

export default meta;

type Story = StoryObj<OnDestroyComponent>;

export const SimpleComponent: Story = {};
