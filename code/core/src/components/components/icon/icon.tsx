import type { ComponentProps } from 'react';
import React, { memo } from 'react';

import { deprecate, logger } from 'storybook/internal/client-logger';

import * as StorybookIcons from '@storybook/icons';

import { styled } from 'storybook/theming';

export type IconType = keyof typeof icons;
type NewIconTypes = (typeof icons)[IconType];

const NEW_ICON_MAP = StorybookIcons as Record<NewIconTypes, (props: unknown) => React.ReactNode>;

const Svg = styled.svg`
  display: inline-block;
  shape-rendering: inherit;
  vertical-align: middle;
  fill: currentColor;
  path {
    fill: currentColor;
  }
`;

export interface IconsProps extends ComponentProps<typeof Svg> {
  icon: IconType;
  useSymbol?: boolean;
  onClick?: () => void;
  __suppressDeprecationWarning?: boolean;
}

// TODO: Remove in SB11
/**
 * @deprecated No longer used, will be removed in Storybook 9.0 Please use the `@storybook/icons`
 *   package instead.
 */
export const Icons = ({
  icon,
  useSymbol,
  __suppressDeprecationWarning = false,
  ...props
}: IconsProps) => {
  if (!__suppressDeprecationWarning) {
    deprecate(
      `Use of the deprecated Icons ${
        `(${icon})` || ''
      } component detected. Please use the @storybook/icons component directly. For more informations, see the migration notes at https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#icons-is-deprecated`
    );
  }

  const findIcon: NewIconTypes = icons[icon] || null;
  if (!findIcon) {
    logger.warn(
      `Use of an unknown prop ${
        `(${icon})` || ''
      } in the Icons component. The Icons component is deprecated. Please use the @storybook/icons component directly. For more informations, see the migration notes at https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#icons-is-deprecated`
    );
    return null;
  }

  const Icon = NEW_ICON_MAP[findIcon];

  return <Icon {...props} />;
};

export interface SymbolsProps {
  icons?: IconType[];
}

// TODO: Remove in SB11
/**
 * @deprecated No longer used, will be removed in Storybook 9.0 Please use the `@storybook/icons`
 *   package instead.
 */
export const Symbols = memo<SymbolsProps>(function Symbols({ icons: keys = Object.keys(icons) }) {
  return (
    <Svg
      viewBox="0 0 14 14"
      style={{ position: 'absolute', width: 0, height: 0 }}
      data-chromatic="ignore"
    >
      {/* @ts-expect-error (non strict) */}
      {keys.map((key: IconType) => (
        <symbol id={`icon--${key}`} key={key}>
          {icons[key]}
        </symbol>
      ))}
    </Svg>
  );
});

export const icons = {
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
} as const;
