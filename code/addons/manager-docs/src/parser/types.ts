export type SourcePosition = {
  line: number;
  column: number;
};

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'emphasis'; children: Inline[] }
  | { type: 'strong'; children: Inline[] }
  | { type: 'inlineCode'; value: string }
  | { type: 'link'; url: string; title?: string; children: Inline[] }
  | { type: 'image'; url: string; alt: string; title?: string };

export type ListItem = {
  children: Block[];
};

export type TableAlign = 'left' | 'right' | 'center' | null;

export const STORY_PANEL_IDS = ['actions', 'interactions'] as const;

export type StoryPanelId = (typeof STORY_PANEL_IDS)[number];

export type StoryPanel = boolean | StoryPanelId[];

export type StoryFrameHeight = '100vh' | number;

export type ComponentProps = Record<string, string | number | boolean>;

export type Block =
  | { type: 'heading'; depth: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; start?: number; items: ListItem[] }
  | { type: 'blockquote'; children: Block[] }
  | { type: 'code'; lang: string | null; value: string }
  | { type: 'thematicBreak' }
  | { type: 'table'; align: TableAlign[]; header: Inline[][]; rows: Inline[][][] }
  | {
      type: 'story';
      moduleName: string;
      exportName: string;
      focus: boolean;
      height?: StoryFrameHeight;
      ratio?: number;
      toolbar?: boolean;
      panel?: StoryPanel;
      position: SourcePosition;
    }
  | {
      type: 'component';
      blockId: string;
      importSource: string;
      exportName: string;
      props: ComponentProps;
      children?: string;
      position: SourcePosition;
    };

export type CsfImport = {
  bindings: string[];
  source: string;
  position: SourcePosition;
};

export type DocsPage = {
  imports: CsfImport[];
  blocks: Block[];
};
