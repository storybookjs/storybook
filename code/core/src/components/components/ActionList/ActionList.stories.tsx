import { CheckIcon, EllipsisIcon, PlayAllHollowIcon } from '@storybook/icons';

import { Badge, Form, ProgressSpinner } from '../..';
import preview from '../../../../../.storybook/preview';
import { Shortcut } from '../../../manager/container/Menu';
import { ActionList } from './ActionList';

const meta = preview.meta({
  component: ActionList,
  decorators: [(Story) => <div style={{ width: 250, border: '1px solid silver' }}>{Story()}</div>],
});

export default meta;

export const Default = meta.story({
  render: () => (
    <ActionList>
      <ActionList.Item>
        <ActionList.Text>Text item</ActionList.Text>
        <ActionList.Button ariaLabel="Options">
          <EllipsisIcon />
        </ActionList.Button>
      </ActionList.Item>
      <ActionList.Item>
        <ActionList.Action>Action item</ActionList.Action>
        <ActionList.Button>
          <PlayAllHollowIcon />
          Cool
        </ActionList.Button>
      </ActionList.Item>
      <ActionList.HoverItem targetId="some-action">
        <ActionList.Action>Hover action</ActionList.Action>
        <ActionList.Button data-target-id="some-action">
          <PlayAllHollowIcon />
          Cool
        </ActionList.Button>
      </ActionList.HoverItem>
      <ActionList.Item>
        <ActionList.Text>With a button</ActionList.Text>
        <ActionList.Button variant="solid">Go</ActionList.Button>
      </ActionList.Item>
      <ActionList.Item>
        <ActionList.Action>
          With an inline button
          <ActionList.Button as="div" readOnly padding="none">
            <ProgressSpinner percentage={25} running={false} size={16} width={1.5} />
            25%
          </ActionList.Button>
        </ActionList.Action>
      </ActionList.Item>
      <ActionList.Item>
        <ActionList.Action>
          With a badge
          <Badge status="positive">Check it out</Badge>
        </ActionList.Action>
      </ActionList.Item>
      <ActionList.Item>
        <ActionList.Action as="label">
          <Form.Checkbox />
          <ActionList.Text>With a checkbox</ActionList.Text>
        </ActionList.Action>
      </ActionList.Item>
      <ActionList.Item active>
        <ActionList.Action>
          <ActionList.Icon>
            <CheckIcon />
          </ActionList.Icon>
          <ActionList.Text>Active with an icon</ActionList.Text>
          <Shortcut keys={['⌘', 'A']} />
        </ActionList.Action>
      </ActionList.Item>
      <ActionList.Item aria-selected="true">
        <ActionList.Text>Selected</ActionList.Text>
      </ActionList.Item>
      <ActionList.Item aria-disabled="true">
        <ActionList.Text>Visually disabled</ActionList.Text>
      </ActionList.Item>
      <ActionList.Item>
        <ActionList.Text>
          Some very long text which will wrap when the container is too narrow
        </ActionList.Text>
      </ActionList.Item>
      <ActionList.Item>
        <ActionList.Text>
          <span>Some very long text which will ellipsize when the container is too narrow</span>
        </ActionList.Text>
      </ActionList.Item>
      <ActionList.Item>
        <ActionList.Action>
          <ActionList.Icon>
            <CheckIcon />
          </ActionList.Icon>
          <ActionList.Text>
            <p>Title</p>
            <small>Description</small>
          </ActionList.Text>
        </ActionList.Action>
      </ActionList.Item>
      <ActionList.Item active>
        <ActionList.Action>
          <ActionList.Icon>
            <CheckIcon />
          </ActionList.Icon>
          <ActionList.Text>
            <p>Some very long text which is going to wrap around</p>
            <small>Here is a very long description which is also going to wrap around</small>
          </ActionList.Text>
        </ActionList.Action>
      </ActionList.Item>
    </ActionList>
  ),
});

export const Groups = meta.story({
  render: () => (
    <>
      <ActionList>
        <ActionList.Item>
          <ActionList.Action>Alpha</ActionList.Action>
        </ActionList.Item>
        <ActionList.Item>
          <ActionList.Action>Item</ActionList.Action>
        </ActionList.Item>
      </ActionList>
      <ActionList>
        <ActionList.Item>
          <ActionList.Action>Bravo</ActionList.Action>
        </ActionList.Item>
        <ActionList.Item>
          <ActionList.Action>Item</ActionList.Action>
        </ActionList.Item>
      </ActionList>
      <ActionList>
        <ActionList.Item>
          <ActionList.Action>Charlie</ActionList.Action>
        </ActionList.Item>
        <ActionList.Item>
          <ActionList.Action>Item</ActionList.Action>
        </ActionList.Item>
      </ActionList>
    </>
  ),
});
