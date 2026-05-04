import type { StoryIndex } from 'storybook/internal/types';

type LeafNode = {
  name: string;
  href: string;
  id: string;
  isActive: boolean;
};

type BranchNode = {
  title: string;
  entries: Record<string, BranchNode | LeafNode>;
  isActive: boolean;
};

export async function maybeSetupPreviewNavigator() {
  const url = new URL(window.location.href);
  if (
    url.searchParams.get('navigator') !== 'true' ||
    (globalThis as any).__STORYBOOK_PREVIEW_NAVIGATOR__
  ) {
    return;
  }
  (globalThis as any).__STORYBOOK_PREVIEW_NAVIGATOR__ = true;

  // TODO: custom story sort is not respected
  const index = (await (await fetch('/index.json')).json()) as StoryIndex;

  const currentEntryId = url.searchParams.get('id');
  if (!currentEntryId) {
    const firstEntry = Object.values(index.entries)[0];
    if (firstEntry) {
      url.searchParams.set('id', firstEntry.id);
      url.searchParams.set('viewMode', firstEntry.type);
      window.location.href = url.toString();
    }
    /*
      We do a hard navigation above, stopping all code execution, so the return here is never reached.
      It's merely there to tell TypeScript that currentEntryId is always defined.
      If there is no firstEntryId, that means there are no entries in the story index,
      and then we want to return early too, because it doesn't make sense to show the sidebar at all.
    */
    return;
  }
  setupPreviewNavigator(index, currentEntryId);
}

export const setupPreviewNavigator = async (index: StoryIndex, currentEntryId: string) => {
  const tree: BranchNode = { title: '', entries: {}, isActive: true };
  for (const entry of Object.values(index.entries)) {
    const titleParts = entry.title.split('/');

    let currentNode = tree;
    for (const titlePart of titleParts) {
      if (!currentNode.entries) {
        currentNode.entries = {};
      }
      if (!currentNode.entries[titlePart]) {
        currentNode.entries[titlePart] = {
          title: titlePart,
          isActive: currentEntryId === entry.id,
          entries: {},
        };
      } else if (currentEntryId === entry.id) {
        currentNode.entries[titlePart].isActive = true;
      }
      currentNode = currentNode.entries[titlePart] as BranchNode;
    }
    if (!currentNode.entries) {
      currentNode.entries = {};
    }
    currentNode.entries[entry.name] = {
      id: entry.id,
      name: entry.name,
      href: `?id=${entry.id}&viewMode=${entry.type}&navigator=true`,
      isActive: currentEntryId === entry.id,
    };
  }

  const createElementForNode = (node: BranchNode | LeafNode): HTMLElement => {
    const li = document.createElement('li');

    if ('entries' in node && 'title' in node) {
      const branchNode = node as BranchNode;
      li.className = 'sb-navigator-branch';

      const details = document.createElement('details');
      if (branchNode.isActive) details.open = true;

      const summary = document.createElement('summary');
      summary.className = 'sb-navigator-title';
      summary.textContent = branchNode.title;

      const ul = document.createElement('ul');
      ul.className = 'sb-navigator-entries';
      ul.setAttribute('aria-label', branchNode.title);

      for (const child of Object.values(branchNode.entries)) {
        ul.appendChild(createElementForNode(child));
      }

      details.appendChild(summary);
      details.appendChild(ul);
      li.appendChild(details);
    } else {
      const leafNode = node as LeafNode;
      li.className = 'sb-navigator-story-item';

      const a = document.createElement('a');
      a.href = leafNode.href;
      a.className = `sb-navigator-story-link${leafNode.isActive ? ' active' : ''}`;
      a.setAttribute('aria-current', leafNode.isActive ? 'location' : 'false');
      a.textContent = leafNode.name;

      li.appendChild(a);
    }

    return li;
  };

  const navList = document.createElement('ul');
  navList.className = 'sb-navigator-list';
  for (const entry of Object.values(tree.entries)) {
    navList.appendChild(createElementForNode(entry));
  }

  const nav = document.createElement('nav');
  nav.id = 'sb-navigator-container';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Story navigation');
  nav.appendChild(navList);

  document.body.insertBefore(nav, document.body.firstChild);

  const style = document.createElement('style');
  style.id = 'sb-navigator-style';
  style.textContent = `
    body {
      display: grid !important;
      grid-template-columns: 300px 1fr;
      font-family: 'Nunito', sans-serif;
      height: 100vh;
      margin: 0;

      --text-color: rgb(46, 52, 56);
      --bg-color: rgb(246, 249, 252);

      @media (prefers-color-scheme: dark) {
        --text-color: rgb(201, 205, 207);
        --bg-color: rgb(34, 36, 37);
      }
    }
    #storybook-root, #storybook-docs {
      overflow-y: auto;
      max-height: 100vh;
      max-width: 100%;
    }
    #sb-navigator-container, #sb-navigator-container * {
      box-sizing: border-box;
    }
    #sb-navigator-container {
        height: 100vh;
        overflow-y: auto;
        border-right: 1px solid #eee;
        padding: 1rem;
        font-size: 14px;
        color: var(--text-color);
        background-color: var(--bg-color);
        align-self: start;
        z-index: 1000;
    }
    .sb-main-padded #sb-navigator-container {
      margin: -1rem 1rem -1rem -1rem;
    }
    .sb-navigator-list {
      list-style-type: none;
      padding: 0;
      margin: 0;
    }
    .sb-navigator-branch {
      list-style-type: none;
    }
    .sb-navigator-item {
      margin-bottom: 15px;
    }
    .sb-navigator-title {
      color: var(--text-color);
      text-decoration: none;
      padding-block: 5px;
      cursor: pointer;
    }
    .sb-navigator-entries {
      padding-left: 15px;
    }
    .sb-navigator-story-item {
      margin-bottom: 8px;
      margin-left: 8px;
    }
    .sb-navigator-story-link {
      color: var(--text-color);
    }
    .sb-navigator-story-link.active {
      font-weight: bold;
      color: hsl(212 100 46);
    }
  `;
  document.head.appendChild(style);

  // scroll to the active component
  nav
    .querySelector('.sb-navigator-story-link.active')
    ?.closest('details')
    ?.scrollIntoView({ block: 'center' });
};

export const teardownPreviewNavigator = () => {
  document.querySelector('#sb-navigator-container')?.remove();
  document.querySelector('#sb-navigator-style')?.remove();
  (globalThis as any).__STORYBOOK_PREVIEW_NAVIGATOR__ = false;
};
