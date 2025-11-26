import React from 'react';
import { storiesOf } from '@storybook/react';
import { withInfo } from '@storybook/addon-info';

import { DocgenButton } from '../components/DocgenButton';
import FlowTypeButton from '../components/FlowTypeButton';
import BaseButton from '../components/BaseButton';
import TableComponent from '../components/TableComponent';

storiesOf('Addons|Info.React Docgen', module)
  .add(
    'Comments from PropType declarations',
    withInfo(
      'Comments above the PropType declarations should be extracted from the React component file itself and rendered in the Info Addon prop table'
    )(() => <DocgenButton label="Docgen Button" />)
  )
  .add(
    'Comments from Flow declarations',
    withInfo(
      'Comments above the Flow declarations should be extracted from the React component file itself and rendered in the Info Addon prop table'
    )(() => <FlowTypeButton label="Flow Typed Button" />)
  )
  .add(
    'Comments from component declaration',
    withInfo(
      'Comments above the component declaration should be extracted from the React component file itself and rendered below the Info Addon heading'
    )(() => <BaseButton label="Button" />)
  );

const markdownDescription = `
#### You can use markdown in your withInfo() description.

Sometimes you might want to manually include some code examples:
~~~js
const Button = () => <button />;
~~~

Maybe include a [link](http://storybook.js.org) to your project as well.
`;

storiesOf('Addons|Info.Markdown', module).add(
  'Displays Markdown in description',
  withInfo(markdownDescription)(() => <BaseButton label="Button" />)
);

storiesOf('Addons|Info.Options.inline', module).add(
  'Inlines component inside story',
  withInfo({
    text: 'Component should be inlined between description and PropType table',
    inline: true, // Displays info inline vs click button to view
  })(() => <BaseButton label="Button" />)
);

storiesOf('Addons|Info.Options.header', module).add(
  'Shows or hides Info Addon header',
  withInfo({
    text: 'The Info Addon header should be hidden',
    header: false, // Toggles display of header with component name and description
  })(() => <BaseButton label="Button" />)
);

storiesOf('Addons|Info.Options.source', module).add(
  'Shows or hides Info Addon source',
  withInfo({
    text: 'The Info Addon source section should be hidden',
    source: false, // Displays the source of story Component
  })(() => <BaseButton label="Button" />)
);

storiesOf('Addons|Info.Options.propTables', module).add(
  'Shows additional component prop tables',
  withInfo({
    text: 'There should be a prop table added for a component not included in the story',
    propTables: [FlowTypeButton],
  })(() => <BaseButton label="Button" />)
);

storiesOf('Addons|Info.Options.propTablesExclude', module).add(
  'Exclude component from prop tables',
  withInfo({
    text: 'This can exclude extraneous components from being displayed in prop tables.',
    propTablesExclude: [FlowTypeButton],
  })(() => (
    <div>
      <BaseButton label="Button" />
      <FlowTypeButton label="Flow Typed Button" />
    </div>
  ))
);

storiesOf('Addons|Info.Options.styles', module)
  .add(
    'Extend info styles with an object',
    withInfo({
      styles: {
        button: {
          base: {
            background: 'purple',
          },
        },
        header: {
          h1: {
            color: 'green',
          },
        },
      },
    })(() => <BaseButton label="Button" />)
  )
  .add(
    'Full control over styles using a function',
    withInfo({
      styles: stylesheet => ({
        ...stylesheet,
        header: {
          ...stylesheet.header,
          h1: {
            ...stylesheet.header.h1,
            color: 'red',
          },
        },
      }),
    })(() => <BaseButton label="Button" />)
  );

storiesOf('Addons|Info.Options.TableComponent', module).add(
  'Use a custom component for the table',
  withInfo({
    TableComponent,
  })(() => <BaseButton label="Button" />)
);

storiesOf('Addons|Info.Decorator', module)
  .addDecorator((story, context) =>
    withInfo('Info could be used as a global or local decorator as well.')(story)(context)
  )
  .add('Use Info as story decorator', () => <BaseButton label="Button" />);

const hoc = WrapComponent => ({ ...props }) => <WrapComponent {...props} />;

const Input = hoc(() => <input type="text" />);

const TextArea = hoc(({ children }) => <textarea>{children}</textarea>);

storiesOf('Addons|Info.GitHub issues', module).add(
  '#1814',
  withInfo('Allow Duplicate DisplayNames for HOC #1814')(() => (
    <div>
      <Input />
      <TextArea />
    </div>
  ))
);
