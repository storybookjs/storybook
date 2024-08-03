import { TabbedArgsTable } from './TabbedArgsTable';
import { Normal, Compact, Sections } from './ArgsTable.stories';

export default {
  component: TabbedArgsTable,
};

export const Tabs = {
  args: {
    tabs: {
      Normal: Normal.args,
      Compact: Compact.args,
      Sections: Sections.args,
    },
  },
};

export const TabsInAddonPanel = {
  args: {
    tabs: {
      Normal: Normal.args,
      Compact: Compact.args,
      Sections: Sections.args,
    },
    inAddonPanel: true,
  },
};

export const Empty = {
  args: {
    tabs: {},
  },
};
