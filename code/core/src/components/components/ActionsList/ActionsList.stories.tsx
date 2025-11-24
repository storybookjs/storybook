import { CheckIcon, EllipsisIcon, PlayAllHollowIcon } from '@storybook/icons';

import { Badge, Form, ProgressSpinner } from '../..';
import preview from '../../../../../.storybook/preview';
import { Shortcut } from '../../../manager/container/Menu';
import { ActionsList } from './ActionsList';

const meta = preview.meta({
  component: ActionsList,
  decorators: [(Story) => <div style={{ width: 250, border: '1px solid silver' }}>{Story()}</div>],
});

export default meta;

export const Default = meta.story({
  render: () => (
    <ActionsList>
      <ActionsList.Item>
        <ActionsList.Text>Text item</ActionsList.Text>
        <ActionsList.Button aria-label="Options">
          <EllipsisIcon />
        </ActionsList.Button>
      </ActionsList.Item>
      <ActionsList.Item>
        <ActionsList.Action>Action item</ActionsList.Action>
        <ActionsList.Button>
          <PlayAllHollowIcon />
          Cool
        </ActionsList.Button>
      </ActionsList.Item>
      <ActionsList.HoverItem targetId="some-action">
        <ActionsList.Action>Hover action</ActionsList.Action>
        <ActionsList.Button data-target-id="some-action">
          <PlayAllHollowIcon />
          Cool
        </ActionsList.Button>
      </ActionsList.HoverItem>
      <ActionsList.Item>
        <ActionsList.Text>With a button</ActionsList.Text>
        <ActionsList.Button variant="solid">Go</ActionsList.Button>
      </ActionsList.Item>
      <ActionsList.Item>
        <ActionsList.Action>
          With an inline button
          <ActionsList.Button as="div" readOnly padding="none">
            <ProgressSpinner percentage={25} running={false} size={16} width={1.5} />
            25%
          </ActionsList.Button>
        </ActionsList.Action>
      </ActionsList.Item>
      <ActionsList.Item>
        <ActionsList.Action>
          With a badge
          <Badge status="positive">Check it out</Badge>
        </ActionsList.Action>
      </ActionsList.Item>
      <ActionsList.Item>
        <ActionsList.Action as="label">
          <Form.Checkbox />
          <ActionsList.Text>With a checkbox</ActionsList.Text>
        </ActionsList.Action>
      </ActionsList.Item>
      <ActionsList.Item active>
        <ActionsList.Action>
          <CheckIcon />
          <ActionsList.Text>Active with an icon</ActionsList.Text>
          <Shortcut keys={['⌘', 'A']} />
        </ActionsList.Action>
      </ActionsList.Item>
      <ActionsList.Item>
        <ActionsList.Text>
          Some very long text which will wrap when the container is too narrow
        </ActionsList.Text>
      </ActionsList.Item>
      <ActionsList.Item>
        <ActionsList.Text>
          <span>Some very long text which will ellipsize when the container is too narrow</span>
        </ActionsList.Text>
      </ActionsList.Item>
    </ActionsList>
  ),
});

export const Groups = meta.story({
  render: () => (
    <>
      <ActionsList>
        <ActionsList.Item>
          <ActionsList.Action>Alpha</ActionsList.Action>
        </ActionsList.Item>
        <ActionsList.Item>
          <ActionsList.Action>Item</ActionsList.Action>
        </ActionsList.Item>
      </ActionsList>
      <ActionsList>
        <ActionsList.Item>
          <ActionsList.Action>Bravo</ActionsList.Action>
        </ActionsList.Item>
        <ActionsList.Item>
          <ActionsList.Action>Item</ActionsList.Action>
        </ActionsList.Item>
      </ActionsList>
      <ActionsList>
        <ActionsList.Item>
          <ActionsList.Action>Charlie</ActionsList.Action>
        </ActionsList.Item>
        <ActionsList.Item>
          <ActionsList.Action>Item</ActionsList.Action>
        </ActionsList.Item>
      </ActionsList>
    </>
  ),
});
