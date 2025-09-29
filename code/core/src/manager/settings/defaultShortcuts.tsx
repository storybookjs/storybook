import type { State } from 'storybook/manager-api';

export const defaultShortcuts: State['shortcuts'] = {
  fullScreen: ['F'],
  togglePanel: ['A'],
  panelPosition: ['D'],
  toggleNav: ['S'],
  toolbar: ['T'],
  search: ['/'],
  focusNav: ['1'],
  focusIframe: ['2'],
  focusPanel: ['3'],
  prevComponent: ['alt', 'ArrowUp'],
  nextComponent: ['alt', 'ArrowDown'],
  prevStory: ['alt', 'ArrowLeft'],
  nextStory: ['alt', 'ArrowRight'],
  shortcutsPage: ['ctrl', 'shift', ','],
  aboutPage: [','],
  escape: ['escape'],
  collapseAll: ['ctrl', 'shift', 'ArrowUp'],
  expandAll: ['ctrl', 'shift', 'ArrowDown'],
  remount: ['alt', 'R'],
  openInEditor: ['alt', 'shift', 'E'],
  copyStoryLink: ['alt', 'shift', 'L'],
  // TODO: bring this back once we want to add shortcuts for this
  // copyStoryName: ['alt', 'shift', 'C'],
};
