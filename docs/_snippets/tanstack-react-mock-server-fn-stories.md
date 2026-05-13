```ts filename="ProfileForm.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect, mocked } from 'storybook/test';

import { updateProfile } from '../lib/updateProfile';
import { ProfileForm } from './ProfileForm';

const meta = {
  component: ProfileForm,
} satisfies Meta<typeof ProfileForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  beforeEach: async () => {
    mocked(updateProfile).mockResolvedValue({ ok: true, name: 'Ada Lovelace' });
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Name'), 'Ada Lovelace');
    await userEvent.click(canvas.getByRole('button', { name: 'Save profile' }));

    await expect(updateProfile).toHaveBeenCalled();
  },
};

export const Failure: Story = {
  beforeEach: async () => {
    mocked(updateProfile).mockRejectedValue(new Error('Could not save profile'));
  },
};
```

```ts filename="ProfileForm.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import { expect, mocked } from 'storybook/test';

import preview from '../.storybook/preview';

import { updateProfile } from '../lib/updateProfile';
import { ProfileForm } from './ProfileForm';

const meta = preview.meta({
  component: ProfileForm,
});

export const Success = meta.story({
  beforeEach: async () => {
    mocked(updateProfile).mockResolvedValue({ ok: true, name: 'Ada Lovelace' });
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Name'), 'Ada Lovelace');
    await userEvent.click(canvas.getByRole('button', { name: 'Save profile' }));

    await expect(updateProfile).toHaveBeenCalled();
  },
});

export const Failure = meta.story({
  beforeEach: async () => {
    mocked(updateProfile).mockRejectedValue(new Error('Could not save profile'));
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->
