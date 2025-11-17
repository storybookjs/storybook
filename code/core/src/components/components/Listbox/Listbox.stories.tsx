import { CheckIcon, EllipsisIcon, PlayAllHollowIcon } from '@storybook/icons';

import { Badge, Form, ProgressSpinner } from '../..';
import preview from '../../../../../.storybook/preview';
import { Shortcut } from '../../../manager/container/Menu';
import { Listbox } from './Listbox';

const meta = preview.meta({
  component: Listbox,
  decorators: [(Story) => <div style={{ width: 250, border: '1px solid silver' }}>{Story()}</div>],
});

export default meta;

export const Default = meta.story({
  render: () => (
    <Listbox>
      <Listbox.Item>
        <Listbox.Text>Text item</Listbox.Text>
        <Listbox.Button aria-label="Options">
          <EllipsisIcon />
        </Listbox.Button>
      </Listbox.Item>
      <Listbox.Item>
        <Listbox.Action>Action item</Listbox.Action>
        <Listbox.Button>
          <PlayAllHollowIcon />
          Cool
        </Listbox.Button>
      </Listbox.Item>
      <Listbox.HoverItem targetId="some-action">
        <Listbox.Action>Hover action</Listbox.Action>
        <Listbox.Button data-target-id="some-action">
          <PlayAllHollowIcon />
          Cool
        </Listbox.Button>
      </Listbox.HoverItem>
      <Listbox.Item>
        <Listbox.Text>With a button</Listbox.Text>
        <Listbox.Button variant="solid">Go</Listbox.Button>
      </Listbox.Item>
      <Listbox.Item>
        <Listbox.Action>
          With an inline button
          <Listbox.Button as="div" readOnly padding="none">
            <ProgressSpinner percentage={25} running={false} size={16} width={1.5} />
            25%
          </Listbox.Button>
        </Listbox.Action>
      </Listbox.Item>
      <Listbox.Item>
        <Listbox.Action>
          With a badge
          <Badge status="positive">Check it out</Badge>
        </Listbox.Action>
      </Listbox.Item>
      <Listbox.Item>
        <Listbox.Action as="label">
          <Form.Checkbox />
          <Listbox.Text>With a checkbox</Listbox.Text>
        </Listbox.Action>
      </Listbox.Item>
      <Listbox.Item active>
        <Listbox.Action>
          <CheckIcon />
          <Listbox.Text>Active with an icon</Listbox.Text>
          <Shortcut keys={['⌘', 'A']} />
        </Listbox.Action>
      </Listbox.Item>
      <Listbox.Item>
        <Listbox.Text>
          Some very long text which will wrap when the container is too narrow
        </Listbox.Text>
      </Listbox.Item>
      <Listbox.Item>
        <Listbox.Text>
          <span>Some very long text which will ellipsize when the container is too narrow</span>
        </Listbox.Text>
      </Listbox.Item>
    </Listbox>
  ),
});

export const Groups = meta.story({
  render: () => (
    <>
      <Listbox>
        <Listbox.Item>
          <Listbox.Action>Alpha</Listbox.Action>
        </Listbox.Item>
        <Listbox.Item>
          <Listbox.Action>Item</Listbox.Action>
        </Listbox.Item>
      </Listbox>
      <Listbox>
        <Listbox.Item>
          <Listbox.Action>Bravo</Listbox.Action>
        </Listbox.Item>
        <Listbox.Item>
          <Listbox.Action>Item</Listbox.Action>
        </Listbox.Item>
      </Listbox>
      <Listbox>
        <Listbox.Item>
          <Listbox.Action>Charlie</Listbox.Action>
        </Listbox.Item>
        <Listbox.Item>
          <Listbox.Action>Item</Listbox.Action>
        </Listbox.Item>
      </Listbox>
    </>
  ),
});
