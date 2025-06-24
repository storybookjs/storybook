import React from 'react';

export default {
  title: 'Addon Panel',
};

export const AllAddons = () => <div>By default all addon panels are rendered</div>;

/*
TODO: this story currently breaks the whole Storybook UI (including the manager).
Current findings:
- Only happens when actions below are disabled, not when a11y is.
- Is related to panels and addon tabs.
- Commenting out code/ui/components/src/tabs/tabs.tsx#L186 fixes the issue.
- ... this line: {list.map(({ id, active, render }) => render({ key: id, active }))}
- The error is most likely the shenanigans we do at code/ui/components/src/tabs/tabs.tsx#childrenToList

export const FilteredAddons = () => <div>By default all addon panels are rendered</div>;
FilteredAddons.parameters = {
  a11y: { disable: true },
  actions: { disable: true },
};
*/
