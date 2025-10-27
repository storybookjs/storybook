import { CheckIcon, EllipsisIcon, PlayAllHollowIcon } from '@storybook/icons';

import { Form } from '../..';
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
        <ListboxAction as="label">
          <Form.Checkbox />
          With a checkbox
        </ListboxAction>
      </ListboxItem>
      <ListboxItem>
        <ListboxAction active>
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
