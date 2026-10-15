import { babelParse, babelPrint, traverse, types as t } from 'storybook/internal/babel';

import picocolors from 'picocolors';

import { isAtOrPastVersion } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';

/**
 * Legacy icon names from the `Icons` map that `@storybook/components` removed, mapped to the
 * `@storybook/icons` export names that replace them. A toolbar configured with a legacy name
 * renders no icon, because the manager resolves names against the `@storybook/icons` namespace.
 */
const legacyIconNames: Record<string, string> = Object.assign(Object.create(null), {
  user: 'UserIcon',
  useralt: 'UserAltIcon',
  useradd: 'UserAddIcon',
  users: 'UsersIcon',
  profile: 'ProfileIcon',
  facehappy: 'FaceHappyIcon',
  faceneutral: 'FaceNeutralIcon',
  facesad: 'FaceSadIcon',
  accessibility: 'AccessibilityIcon',
  accessibilityalt: 'AccessibilityAltIcon',
  accessibilityignored: 'AccessibilityIgnoredIcon',
  arrowup: 'ChevronUpIcon',
  arrowdown: 'ChevronDownIcon',
  arrowleft: 'ChevronLeftIcon',
  arrowright: 'ChevronRightIcon',
  arrowupalt: 'ArrowUpIcon',
  arrowdownalt: 'ArrowDownIcon',
  arrowleftalt: 'ArrowLeftIcon',
  arrowrightalt: 'ArrowRightIcon',
  arrowtopleft: 'ArrowTopLeftIcon',
  arrowtopright: 'ArrowTopRightIcon',
  arrowbottomleft: 'ArrowBottomLeftIcon',
  arrowbottomright: 'ArrowBottomRightIcon',
  arrowsolidup: 'ArrowSolidUpIcon',
  arrowsoliddown: 'ArrowSolidDownIcon',
  arrowsolidleft: 'ArrowSolidLeftIcon',
  arrowsolidright: 'ArrowSolidRightIcon',
  chevronsmallup: 'ChevronSmallUpIcon',
  chevronsmalldown: 'ChevronSmallDownIcon',
  chevronsmallleft: 'ChevronSmallLeftIcon',
  chevronsmallright: 'ChevronSmallRightIcon',
  expandalt: 'ExpandAltIcon',
  collapse: 'CollapseIcon',
  expand: 'ExpandIcon',
  unfold: 'UnfoldIcon',
  transfer: 'TransferIcon',
  redirect: 'RedirectIcon',
  jumpto: 'JumpToIcon',
  popout: 'PopOutIcon',
  undo: 'UndoIcon',
  reply: 'ReplyIcon',
  sync: 'SyncIcon',
  upload: 'UploadIcon',
  download: 'DownloadIcon',
  save: 'SaveIcon',
  back: 'BackIcon',
  proceed: 'ProceedIcon',
  refresh: 'RefreshIcon',
  globe: 'GlobeIcon',
  compass: 'CompassIcon',
  direction: 'DirectionIcon',
  location: 'LocationIcon',
  pin: 'PinIcon',
  time: 'TimeIcon',
  dashboard: 'DashboardIcon',
  timer: 'TimerIcon',
  home: 'HomeIcon',
  admin: 'AdminIcon',
  info: 'InfoIcon',
  question: 'QuestionIcon',
  support: 'SupportIcon',
  bug: 'BugIcon',
  alert: 'AlertIcon',
  alertalt: 'AlertAltIcon',
  email: 'EmailIcon',
  phone: 'PhoneIcon',
  link: 'LinkIcon',
  unlink: 'LinkBrokenIcon',
  bell: 'BellIcon',
  rss: 'RSSIcon',
  sharealt: 'ShareAltIcon',
  share: 'ShareIcon',
  circle: 'CircleIcon',
  circlehollow: 'CircleHollowIcon',
  diamond: 'DiamondIcon',
  bookmarkhollow: 'BookmarkHollowIcon',
  bookmark: 'BookmarkIcon',
  hearthollow: 'HeartHollowIcon',
  heart: 'HeartIcon',
  starhollow: 'StarHollowIcon',
  star: 'StarIcon',
  certificate: 'CertificateIcon',
  verified: 'VerifiedIcon',
  thumbsup: 'ThumbsUpIcon',
  shield: 'ShieldIcon',
  basket: 'BasketIcon',
  beaker: 'BeakerIcon',
  hourglass: 'HourglassIcon',
  flag: 'FlagIcon',
  gift: 'GiftIcon',
  sticker: 'StickerIcon',
  cloudhollow: 'CloudHollowIcon',
  cloud: 'CloudIcon',
  edit: 'EditIcon',
  editor: 'EditorIcon',
  cog: 'CogIcon',
  nut: 'NutIcon',
  wrench: 'WrenchIcon',
  wand: 'WandIcon',
  ellipsis: 'EllipsisIcon',
  check: 'CheckIcon',
  checklist: 'ChecklistIcon',
  form: 'FormIcon',
  batchdeny: 'BatchDenyIcon',
  batchaccept: 'BatchAcceptIcon',
  controls: 'ControlsIcon',
  plus: 'PlusIcon',
  closeAlt: 'CloseAltIcon',
  cross: 'CrossIcon',
  trash: 'TrashIcon',
  pinalt: 'PinAltIcon',
  unpin: 'UnpinIcon',
  add: 'AddIcon',
  subtract: 'SubtractIcon',
  close: 'CloseIcon',
  delete: 'DeleteIcon',
  passed: 'PassedIcon',
  changed: 'ChangedIcon',
  failed: 'FailedIcon',
  status: 'StatusIcon',
  statuspass: 'StatusPassIcon',
  statusfail: 'StatusFailIcon',
  statuswarn: 'StatusWarnIcon',
  statusnew: 'StatusNewIcon',
  clear: 'ClearIcon',
  sweep: 'SweepIcon',
  comment: 'CommentIcon',
  commentadd: 'CommentAddIcon',
  requestchange: 'RequestChangeIcon',
  comments: 'CommentsIcon',
  chat: 'ChatIcon',
  lock: 'LockIcon',
  unlock: 'UnlockIcon',
  key: 'KeyIcon',
  command: 'CommandIcon',
  outbox: 'OutboxIcon',
  credit: 'CreditIcon',
  button: 'ButtonIcon',
  type: 'TypeIcon',
  pointerdefault: 'PointerDefaultIcon',
  pointerhand: 'PointerHandIcon',
  browser: 'BrowserIcon',
  tablet: 'TabletIcon',
  mobile: 'MobileIcon',
  watch: 'WatchIcon',
  sidebar: 'SidebarIcon',
  sidebaralt: 'SidebarAltIcon',
  sidebaralttoggle: 'SidebarAltToggleIcon',
  sidebartoggle: 'SidebarToggleIcon',
  bottombar: 'BottomBarIcon',
  bottombartoggle: 'BottomBarToggleIcon',
  cpu: 'CPUIcon',
  database: 'DatabaseIcon',
  memory: 'MemoryIcon',
  structure: 'StructureIcon',
  box: 'BoxIcon',
  power: 'PowerIcon',
  photo: 'PhotoIcon',
  component: 'ComponentIcon',
  grid: 'GridIcon',
  gridalt: 'GridAltIcon',
  outline: 'OutlineIcon',
  photodrag: 'PhotoDragIcon',
  photostabilize: 'PhotoStabilizeIcon',
  drag: 'DragIcon',
  search: 'SearchIcon',
  zoom: 'ZoomIcon',
  zoomout: 'ZoomOutIcon',
  zoomreset: 'ZoomResetIcon',
  eye: 'EyeIcon',
  eyeclose: 'EyeCloseIcon',
  lightning: 'LightningIcon',
  lightningoff: 'LightningOffIcon',
  contrast: 'ContrastIcon',
  contrastignored: 'ContrastIgnoredIcon',
  switchalt: 'SwitchAltIcon',
  mirror: 'MirrorIcon',
  grow: 'GrowIcon',
  paintbrush: 'PaintBrushIcon',
  paintbrushalt: 'PaintBrushAltIcon',
  ruler: 'RulerIcon',
  stop: 'StopIcon',
  camera: 'CameraIcon',
  camerastabilize: 'CameraStabilizeIcon',
  video: 'VideoIcon',
  speaker: 'SpeakerIcon',
  play: 'PlayIcon',
  playback: 'PlayBackIcon',
  playnext: 'PlayNextIcon',
  playhollow: 'PlayHollowIcon',
  playallhollow: 'PlayAllHollowIcon',
  rewind: 'RewindIcon',
  fastforward: 'FastForwardIcon',
  stopalt: 'StopAltIcon',
  stopalthollow: 'StopAltHollowIcon',
  sidebyside: 'SideBySideIcon',
  stacked: 'StackedIcon',
  sun: 'SunIcon',
  moon: 'MoonIcon',
  book: 'BookIcon',
  document: 'DocumentIcon',
  copy: 'CopyIcon',
  category: 'CategoryIcon',
  folder: 'FolderIcon',
  files: 'FilesIcon',
  print: 'PrintIcon',
  graphline: 'GraphLineIcon',
  calendar: 'CalendarIcon',
  graphbar: 'GraphBarIcon',
  menu: 'MenuIcon',
  menualt: 'MenuIcon',
  filter: 'FilterIcon',
  sortup: 'SortUpIcon',
  sortdown: 'SortDownIcon',
  docchart: 'DocChartIcon',
  doclist: 'DocListIcon',
  markup: 'MarkupIcon',
  bold: 'BoldIcon',
  italic: 'ItalicIcon',
  alignleft: 'AlignLeftIcon',
  alignright: 'AlignRightIcon',
  paperclip: 'PaperClipIcon',
  listordered: 'ListOrderedIcon',
  listunordered: 'ListUnorderedIcon',
  paragraph: 'ParagraphIcon',
  markdown: 'MarkdownIcon',
  repository: 'RepoIcon',
  commit: 'CommitIcon',
  branch: 'BranchIcon',
  pullrequest: 'PullRequestIcon',
  merge: 'MergeIcon',
  apple: 'AppleIcon',
  linux: 'LinuxIcon',
  ubuntu: 'UbuntuIcon',
  windows: 'WindowsIcon',
  storybook: 'StorybookIcon',
  azuredevops: 'AzureDevOpsIcon',
  bitbucket: 'BitbucketIcon',
  chrome: 'ChromeIcon',
  chromatic: 'ChromaticIcon',
  componentdriven: 'ComponentDrivenIcon',
  discord: 'DiscordIcon',
  facebook: 'FacebookIcon',
  figma: 'FigmaIcon',
  gdrive: 'GDriveIcon',
  github: 'GithubIcon',
  gitlab: 'GitlabIcon',
  google: 'GoogleIcon',
  graphql: 'GraphqlIcon',
  linkedin: 'LinkedinIcon',
  medium: 'MediumIcon',
  redux: 'ReduxIcon',
  twitter: 'TwitterIcon',
  x: 'XIcon',
  youtube: 'YoutubeIcon',
  vscode: 'VSCodeIcon',
});

const legacyIconPattern = new RegExp(
  'icon\\s*:\\s*[\'"](?:' + Object.keys(legacyIconNames).join('|') + ')[\'"]'
);

const isLegacyIconName = (value: string): boolean => Object.hasOwn(legacyIconNames, value);

const renameIconProperty = (object: t.ObjectExpression): boolean => {
  let changed = false;
  for (const property of object.properties) {
    if (
      t.isObjectProperty(property) &&
      !property.computed &&
      t.isIdentifier(property.key, { name: 'icon' }) &&
      t.isStringLiteral(property.value) &&
      isLegacyIconName(property.value.value)
    ) {
      property.value = t.stringLiteral(legacyIconNames[property.value.value]);
      changed = true;
    }
  }
  return changed;
};

// `properties.find` predicates as type guards: `ObjectExpression.properties` mixes ObjectMethod,
// ObjectProperty and SpreadElement, and only a guard narrows the found entry — so `.value` is
// accessible without a cast, with the object/array shape asserted where it is checked.
const isToolbarProperty = (
  property: t.ObjectExpression['properties'][number]
): property is t.ObjectProperty & { value: t.ObjectExpression } =>
  t.isObjectProperty(property) &&
  !property.computed &&
  t.isIdentifier(property.key, { name: 'toolbar' }) &&
  t.isObjectExpression(property.value);

const isItemsProperty = (
  property: t.ObjectExpression['properties'][number]
): property is t.ObjectProperty & { value: t.ArrayExpression } =>
  t.isObjectProperty(property) &&
  !property.computed &&
  t.isIdentifier(property.key, { name: 'items' }) &&
  t.isArrayExpression(property.value);

const rewriteLegacyIconNames = (code: string) => {
  let ast;
  try {
    ast = babelParse(code);
  } catch {
    return undefined;
  }
  let changed = false;

  traverse(ast, {
    ObjectExpression(path) {
      // Toolbar configs live under a `toolbar` key in `globalTypes` (preview) and `argTypes`
      // (stories): `{ toolbar: { icon, items: [{ icon }] } }`
      const toolbarProperty = path.node.properties.find(isToolbarProperty);
      if (!toolbarProperty) {
        return;
      }
      changed = renameIconProperty(toolbarProperty.value) || changed;
      const itemsProperty = toolbarProperty.value.properties.find(isItemsProperty);
      if (itemsProperty) {
        for (const element of itemsProperty.value.elements) {
          if (t.isObjectExpression(element)) {
            changed = renameIconProperty(element) || changed;
          }
        }
      }
    },
  });

  if (!changed) {
    return undefined;
  }
  const printed = babelPrint(ast);
  return printed === code ? undefined : printed;
};

export const legacyToolbarIcons: Fix = {
  id: 'legacy-toolbar-icons',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#toolbar-icon-no-longer-accepts-legacy-icon-names',
  prompt: () =>
    `Rewrite legacy toolbar icon names to ${picocolors.cyan(
      '@storybook/icons'
    )} export names (e.g. ${picocolors.cyan("icon: 'globe'")} to ${picocolors.cyan(
      "icon: 'GlobeIcon'"
    )})`,

  // 10.x still resolves toolbar icons through the removed legacy-name map, so only rewrite once
  // the project is on 11, where the manager resolves export names instead.
  check: async ({ storybookVersion }) =>
    isAtOrPastVersion(storybookVersion, '11.0.0') ? {} : null,

  transform: () => [
    {
      filter: { kind: ['preview', 'story', 'config'], code: legacyIconPattern },
      handler: rewriteLegacyIconNames,
    },
  ],
};
