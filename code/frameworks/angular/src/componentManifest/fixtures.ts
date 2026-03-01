import { Tag } from 'storybook/internal/core-server';

import { dedent } from 'ts-dedent';

import type { CompodocJson } from '../client/compodoc-types';

/**
 * Compodoc documentation.json fixture for Angular component tests.
 */
export const sampleCompodocJson: CompodocJson = {
  components: [
    {
      name: 'ButtonComponent',
      type: 'component',
      selector: 'app-button',
      description: '<p>Primary UI component for user interaction</p>',
      rawdescription:
        'Primary UI component for user interaction\n@import import { ButtonComponent } from \'@design-system/components/override\';',
      inputsClass: [
        {
          name: 'label',
          type: 'string',
          optional: false,
          description: '',
          rawdescription: '',
        },
        {
          name: 'primary',
          type: 'boolean',
          optional: true,
          defaultValue: 'false',
          description: 'Description of primary',
          rawdescription: 'Description of primary',
        },
        {
          name: 'size',
          type: "'small' | 'medium' | 'large'",
          optional: true,
          defaultValue: "'medium'",
          description: '',
          rawdescription: '',
        },
        {
          name: 'backgroundColor',
          type: 'string',
          optional: true,
          description: '',
          rawdescription: '',
        },
      ],
      outputsClass: [
        {
          name: 'onClick',
          type: 'EventEmitter<void>',
          optional: false,
          description: '',
          rawdescription: '',
        },
      ],
      propertiesClass: [],
      methodsClass: [],
      file: 'src/stories/button.component.ts',
    } as any,
    {
      name: 'HeaderComponent',
      type: 'component',
      selector: 'app-header',
      description: '',
      rawdescription: '',
      inputsClass: [
        {
          name: 'user',
          type: 'User',
          optional: true,
          description: '',
          rawdescription: '',
        },
      ],
      outputsClass: [
        { name: 'onLogin', type: 'EventEmitter<void>', optional: true, description: '' },
        { name: 'onLogout', type: 'EventEmitter<void>', optional: true, description: '' },
        {
          name: 'onCreateAccount',
          type: 'EventEmitter<void>',
          optional: true,
          description: '',
        },
      ],
      propertiesClass: [],
      methodsClass: [],
      file: 'src/stories/header.component.ts',
    } as any,
  ],
  directives: [],
  pipes: [],
  injectables: [],
  classes: [],
};

export const fsMocks: Record<string, string> = {
  ['./package.json']: JSON.stringify({ name: 'some-package' }),
  ['./documentation.json']: JSON.stringify(sampleCompodocJson),
  ['./src/stories/button.stories.ts']: dedent`
    import type { Meta, StoryObj } from '@storybook/angular';
    import { fn } from 'storybook/test';
    import { ButtonComponent } from './button.component';

    const meta: Meta<ButtonComponent> = {
      title: 'Example/Button',
      component: ButtonComponent,
      args: { onClick: fn() },
    };
    export default meta;
    type Story = StoryObj<typeof meta>;

    export const Primary: Story = { args: { primary: true, label: 'Button' } };
    export const Secondary: Story = { args: { label: 'Button' } };
    export const Large: Story = { args: { size: 'large', label: 'Button' } };
    export const Small: Story = { args: { size: 'small', label: 'Button' } };`,

  ['./src/stories/header.stories.ts']: dedent`
    import type { Meta, StoryObj } from '@storybook/angular';
    import { fn } from 'storybook/test';
    import { HeaderComponent } from './header.component';

    /**
     * Description from meta and very long.
     * @summary Component summary
     */
    const meta: Meta<HeaderComponent> = {
      title: 'Example/Header',
      component: HeaderComponent,
      args: {
        onLogin: fn(),
        onLogout: fn(),
        onCreateAccount: fn(),
      },
    };
    export default meta;
    type Story = StoryObj<typeof meta>;
    export const LoggedIn: Story = { args: { user: { name: 'Jane Doe' } } };
    export const LoggedOut: Story = {};`,
};

export const indexJson = {
  v: 5,
  entries: {
    'example-button--primary': {
      type: 'story',
      subtype: 'story',
      id: 'example-button--primary',
      name: 'Primary',
      title: 'Example/Button',
      importPath: './src/stories/button.stories.ts',
      componentPath: './src/stories/button.component.ts',
      tags: [Tag.DEV, Tag.TEST, 'vitest', Tag.AUTODOCS, Tag.MANIFEST],
      exportName: 'Primary',
    },
    'example-button--secondary': {
      type: 'story',
      subtype: 'story',
      id: 'example-button--secondary',
      name: 'Secondary',
      title: 'Example/Button',
      importPath: './src/stories/button.stories.ts',
      componentPath: './src/stories/button.component.ts',
      tags: [Tag.DEV, Tag.TEST, 'vitest', Tag.AUTODOCS, Tag.MANIFEST],
      exportName: 'Secondary',
    },
    'example-button--large': {
      type: 'story',
      subtype: 'story',
      id: 'example-button--large',
      name: 'Large',
      title: 'Example/Button',
      importPath: './src/stories/button.stories.ts',
      componentPath: './src/stories/button.component.ts',
      tags: [Tag.DEV, Tag.TEST, 'vitest', Tag.AUTODOCS, Tag.MANIFEST],
      exportName: 'Large',
    },
    'example-button--small': {
      type: 'story',
      subtype: 'story',
      id: 'example-button--small',
      name: 'Small',
      title: 'Example/Button',
      importPath: './src/stories/button.stories.ts',
      componentPath: './src/stories/button.component.ts',
      tags: [Tag.DEV, Tag.TEST, 'vitest', Tag.AUTODOCS, Tag.MANIFEST],
      exportName: 'Small',
    },
    'example-header--docs': {
      id: 'example-header--docs',
      title: 'Example/Header',
      name: 'Docs',
      importPath: './src/stories/header.stories.ts',
      type: 'docs',
      tags: [Tag.DEV, Tag.TEST, 'vitest', Tag.AUTODOCS],
      storiesImports: [],
    },
    'example-header--logged-in': {
      type: 'story',
      subtype: 'story',
      id: 'example-header--logged-in',
      name: 'Logged In',
      title: 'Example/Header',
      importPath: './src/stories/header.stories.ts',
      componentPath: './src/stories/header.component.ts',
      tags: [Tag.DEV, Tag.TEST, 'vitest', Tag.AUTODOCS, Tag.MANIFEST],
      exportName: 'LoggedIn',
    },
    'example-header--logged-out': {
      type: 'story',
      subtype: 'story',
      id: 'example-header--logged-out',
      name: 'Logged Out',
      title: 'Example/Header',
      importPath: './src/stories/header.stories.ts',
      componentPath: './src/stories/header.component.ts',
      tags: [Tag.DEV, Tag.TEST, 'vitest', Tag.AUTODOCS, Tag.MANIFEST],
      exportName: 'LoggedOut',
    },
  },
};
