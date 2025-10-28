import { CheckIcon, EllipsisIcon, PlayAllHollowIcon } from '@storybook/icons';

import { Badge, Form, ProgressSpinner } from '../..';
import preview from '../../../../../.storybook/preview';
import { Shortcut } from '../../../manager/container/Menu';
import { Listbox, ListboxAction, ListboxButton, ListboxItem, ListboxText } from './Listbox';

const meta = preview.meta({
  component: Listbox,
  decorators: [(Story) => <div style={{ width: 250, border: '1px solid silver' }}>{Story()}</div>],
});

export default meta;

export const Default = meta.story({
  render: () => (
    <Listbox>
      <ListboxItem>
        <ListboxText>Text item</ListboxText>
        <ListboxButton aria-label="Options">
          <EllipsisIcon />
        </ListboxButton>
      </ListboxItem>
      <ListboxItem>
        <ListboxAction>Action item</ListboxAction>
        <ListboxButton>
          <PlayAllHollowIcon />
          Cool
        </ListboxButton>
      </ListboxItem>
      <ListboxItem>
        <ListboxText>With a button</ListboxText>
        <ListboxButton variant="solid">Go</ListboxButton>
      </ListboxItem>
      <ListboxItem>
        <ListboxAction>
          With an inline button
          <ListboxButton readOnly padding="none">
            <ProgressSpinner percentage={25} running={false} size={16} width={1.5} />
            25%
          </ListboxButton>
        </ListboxAction>
      </ListboxItem>
      <ListboxItem>
        <ListboxAction>
          With a badge
          <Badge status="positive">Check it out</Badge>
        </ListboxAction>
      </ListboxItem>
      <ListboxItem>
        <ListboxAction as="label">
          <Form.Checkbox />
          <ListboxText>With a checkbox</ListboxText>
        </ListboxAction>
      </ListboxItem>
      <ListboxItem active>
        <ListboxAction>
          <CheckIcon />
          <ListboxText>Active with an icon</ListboxText>
          <Shortcut keys={['⌘', 'A']} />
        </ListboxAction>
      </ListboxItem>
    </Listbox>
  ),
});

export const Groups = meta.story({
  render: () => (
    <>
      <Listbox>
        <ListboxItem>
          <ListboxAction>Alpha</ListboxAction>
        </ListboxItem>
        <ListboxItem>
          <ListboxAction>Item</ListboxAction>
        </ListboxItem>
      </Listbox>
      <Listbox>
        <ListboxItem>
          <ListboxAction>Bravo</ListboxAction>
        </ListboxItem>
        <ListboxItem>
          <ListboxAction>Item</ListboxAction>
        </ListboxItem>
      </Listbox>
      <Listbox>
        <ListboxItem>
          <ListboxAction>Charlie</ListboxAction>
        </ListboxItem>
        <ListboxItem>
          <ListboxAction>Item</ListboxAction>
        </ListboxItem>
      </Listbox>
    </>
  ),
});
