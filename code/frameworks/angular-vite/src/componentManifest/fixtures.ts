import { dedent } from 'ts-dedent';

export const fsMocks = {
  ['./documentation.json']: JSON.stringify({
    components: [
      {
        name: 'ButtonComponent',
        type: 'component',
        selector: 'app-button',
        standalone: true,
        changeDetection: 'ChangeDetectionStrategy.OnPush',
        description: 'Primary UI component for user interaction.',
        rawdescription: 'Primary UI component for user interaction.',
        inputsClass: [
          {
            name: 'label',
            type: 'string',
            optional: true,
            defaultValue: "'Click me'",
            description: 'Text displayed inside the button.',
          },
          {
            name: 'disabled',
            type: 'boolean',
            optional: true,
            defaultValue: 'false',
            description: 'When true the button is non-interactive.',
          },
        ],
        outputsClass: [
          {
            name: 'clicked',
            type: 'EventEmitter<void>',
            optional: true,
            description: 'Emitted when the user clicks the button.',
          },
        ],
        propertiesClass: [],
        methodsClass: [],
      },
    ],
    directives: [
      {
        name: 'LibBtnDirective',
        type: 'directive',
        selector: 'button[lib-btn], a[lib-btn]',
        standalone: true,
        description: 'Attaches library button styling to any host element.',
        rawdescription: 'Attaches library button styling to any host element.',
        inputsClass: [
          {
            name: 'variant',
            type: '"primary" | "secondary"',
            optional: true,
            defaultValue: "'primary'",
            description: 'Visual variant of the button.',
          },
        ],
        outputsClass: [],
        propertiesClass: [],
        methodsClass: [],
      },
    ],
    pipes: [],
    injectables: [],
    classes: [],
  }),

  ['./src/button/button.component.ts']: dedent`
    import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

    /**
     * Primary UI component for user interaction.
     */
    @Component({
      selector: 'app-button',
      standalone: true,
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: '<button [disabled]="disabled">{{ label }}</button>',
    })
    export class ButtonComponent {
      /** Text displayed inside the button. */
      @Input() label = 'Click me';
      /** When true the button is non-interactive. */
      @Input() disabled = false;
      /** Emitted when the user clicks the button. */
      @Output() clicked = new EventEmitter<void>();
    }
  `,
  ['./src/button/button.stories.ts']: dedent`
    import type { Meta, StoryObj } from '@storybook/angular-vite';
    import { ButtonComponent } from './button.component';

    const meta: Meta<ButtonComponent> = {
      title: 'Components/Button',
      component: ButtonComponent,
    };
    export default meta;

    export const Primary: StoryObj<ButtonComponent> = {
      args: { label: 'Click me', disabled: false },
    };
  `,

  ['./src/lib-btn/lib-btn.directive.ts']: dedent`
    import { Directive, Input } from '@angular/core';

    /**
     * Attaches library button styling to any host element.
     */
    @Directive({ selector: 'button[lib-btn], a[lib-btn]', standalone: true })
    export class LibBtnDirective {
      /** Visual variant of the button. */
      @Input() variant: 'primary' | 'secondary' = 'primary';
    }
  `,
  ['./src/lib-btn/lib-btn.stories.ts']: dedent`
    import type { Meta, StoryObj } from '@storybook/angular-vite';
    import { LibBtnDirective } from './lib-btn.directive';

    const meta: Meta<LibBtnDirective> = {
      title: 'Directives/LibBtn',
      component: LibBtnDirective,
    };
    export default meta;

    export const Primary: StoryObj<LibBtnDirective> = {};
  `,
};
