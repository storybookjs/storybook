import type { ComponentProps, FC } from 'react';
import React, { Component } from 'react';
import { styled, keyframes } from '@storybook/core/theming';

import {
  eventToShortcut,
  shortcutToHumanString,
  shortcutMatchesShortcut,
} from '@storybook/core/manager-api';
import { Button, Form } from '@storybook/core/components';
import SettingsFooter from './SettingsFooter';
import { CheckIcon } from '@storybook/icons';

const Header = styled.header(({ theme }) => ({
  marginBottom: 20,
  fontSize: theme.typography.size.m3,
  fontWeight: theme.typography.weight.bold,
  alignItems: 'center',
  display: 'flex',
}));

// Grid
export const HeaderItem = styled.div(({ theme }) => ({
  fontWeight: theme.typography.weight.bold,
}));

export const GridHeaderRow = styled.div({
  alignSelf: 'flex-end',
  display: 'grid',
  margin: '10px 0',
  gridTemplateColumns: '1fr 1fr 12px',
  '& > *:last-of-type': {
    gridColumn: '2 / 2',
    justifySelf: 'flex-end',
    gridRow: '1',
  },
});

export const Row = styled.div(({ theme }) => ({
  padding: '6px 0',
  borderTop: `1px solid ${theme.appBorderColor}`,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 0px',
}));

export const GridWrapper = styled.div({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gridAutoRows: 'minmax(auto, auto)',
  marginBottom: 20,
});

// Form
export const Description = styled.div({
  alignSelf: 'center',
});

export type ValidationStates = 'valid' | 'error' | 'warn';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore-error (this errors only when compiling for production mode)
export const TextInput: FC<ComponentProps<typeof Form.Input> & { valid: ValidationStates }> =
  styled(Form.Input)<{ valid: ValidationStates }>(
    ({ valid, theme }) =>
      valid === 'error'
        ? {
            animation: `${theme.animation.jiggle} 700ms ease-out`,
          }
        : {},
    {
      display: 'flex',
      width: 80,
      flexDirection: 'column',
      justifySelf: 'flex-end',
      paddingLeft: 4,
      paddingRight: 4,
      textAlign: 'center',
    }
  );

export const Fade = keyframes`
0%,100% { opacity: 0; }
  50% { opacity: 1; }
`;

const SuccessIcon = styled(CheckIcon)<{ valid: string }>(
  ({ valid, theme }) =>
    valid === 'valid'
      ? {
          color: theme.color.positive,
          animation: `${Fade} 2s ease forwards`,
        }
      : {
          opacity: 0,
        },
  {
    alignSelf: 'center',
    display: 'flex',
    marginLeft: 10,
    height: 14,
    width: 14,
  }
);

const Container = styled.div(({ theme }) => ({
  fontSize: theme.typography.size.s2,
  padding: `3rem 20px`,
  maxWidth: 600,
  margin: '0 auto',
}));

const shortcutLabels = {
  fullScreen: 'Go full screen',
  togglePanel: 'Toggle addons',
  panelPosition: 'Toggle addons orientation',
  toggleNav: 'Toggle sidebar',
  toolbar: 'Toggle canvas toolbar',
  search: 'Focus search',
  focusNav: 'Focus sidebar',
  focusIframe: 'Focus canvas',
  focusPanel: 'Focus addons',
  prevComponent: 'Previous component',
  nextComponent: 'Next component',
  prevStory: 'Previous story',
  nextStory: 'Next story',
  shortcutsPage: 'Go to shortcuts page',
  aboutPage: 'Go to about page',
  collapseAll: 'Collapse all items on sidebar',
  expandAll: 'Expand all items on sidebar',
  remount: 'Remount component',
};

export type Feature = keyof typeof shortcutLabels;

// Shortcuts that cannot be configured
const fixedShortcuts = ['escape'];

function toShortcutState(shortcutKeys: ShortcutsScreenProps['shortcutKeys']) {
  return Object.entries(shortcutKeys).reduce(
    // @ts-expect-error (non strict)
    (acc, [feature, shortcut]: [Feature, string]) =>
      fixedShortcuts.includes(feature) ? acc : { ...acc, [feature]: { shortcut, error: false } },
    {} as Record<Feature, any>
  );
}

export interface ShortcutsScreenState {
  activeFeature: Feature;
  successField: Feature;
  shortcutKeys: Record<Feature, any>;
  addonsShortcutLabels?: Record<string, string>;
}

export interface ShortcutsScreenProps {
  shortcutKeys: Record<Feature, any>;
  addonsShortcutLabels?: Record<string, string>;
  setShortcut: Function;
  restoreDefaultShortcut: Function;
  restoreAllDefaultShortcuts: Function;
}

class ShortcutsScreen extends Component<ShortcutsScreenProps, ShortcutsScreenState> {
  constructor(props: ShortcutsScreenProps) {
    super(props);
    this.state = {
      // @ts-expect-error (non strict)
      activeFeature: undefined,
      // @ts-expect-error (non strict)
      successField: undefined,
      // The initial shortcutKeys that come from props are the defaults/what was saved
      // As the user interacts with the page, the state stores the temporary, unsaved shortcuts
      // This object also includes the error attached to each shortcut
      // @ts-expect-error (non strict)
      shortcutKeys: toShortcutState(props.shortcutKeys),
      addonsShortcutLabels: props.addonsShortcutLabels,
    };
  }

  onKeyDown = (e: KeyboardEvent) => {
    const { activeFeature, shortcutKeys } = this.state;

    if (e.key === 'Backspace') {
      return this.restoreDefault();
    }

    const shortcut = eventToShortcut(e);

    // Keypress is not a potential shortcut
    if (!shortcut) {
      return false;
    }

    // Check we don't match any other shortcuts
    const error = !!Object.entries(shortcutKeys).find(
      ([feature, { shortcut: existingShortcut }]) =>
        feature !== activeFeature &&
        existingShortcut &&
        shortcutMatchesShortcut(shortcut, existingShortcut)
    );

    return this.setState({
      shortcutKeys: { ...shortcutKeys, [activeFeature]: { shortcut, error } },
    });
  };

  onFocus = (focusedInput: Feature) => () => {
    const { shortcutKeys } = this.state;

    this.setState({
      activeFeature: focusedInput,
      shortcutKeys: {
        ...shortcutKeys,
        [focusedInput]: { shortcut: null, error: false },
      },
    });
  };

  onBlur = async () => {
    const { shortcutKeys, activeFeature } = this.state;

    if (shortcutKeys[activeFeature]) {
      const { shortcut, error } = shortcutKeys[activeFeature];
      if (!shortcut || error) {
        return this.restoreDefault();
      }
      return this.saveShortcut();
    }
    return false;
  };

  saveShortcut = async () => {
    const { activeFeature, shortcutKeys } = this.state;

    const { setShortcut } = this.props;
    await setShortcut(activeFeature, shortcutKeys[activeFeature].shortcut);
    this.setState({ successField: activeFeature });
  };

  restoreDefaults = async () => {
    const { restoreAllDefaultShortcuts } = this.props;

    const defaultShortcuts = await restoreAllDefaultShortcuts();
    // @ts-expect-error (non strict)
    return this.setState({ shortcutKeys: toShortcutState(defaultShortcuts) });
  };

  restoreDefault = async () => {
    const { activeFeature, shortcutKeys } = this.state;

    const { restoreDefaultShortcut } = this.props;

    const defaultShortcut = await restoreDefaultShortcut(activeFeature);
    return this.setState({
      shortcutKeys: {
        ...shortcutKeys,
        ...toShortcutState({ [activeFeature]: defaultShortcut } as Record<Feature, any>),
      },
    });
  };

  displaySuccessMessage = (activeElement: Feature) => {
    const { successField, shortcutKeys } = this.state;
    return activeElement === successField && shortcutKeys[activeElement].error === false
      ? 'valid'
      : undefined;
  };

  displayError = (activeElement: Feature): ValidationStates => {
    const { activeFeature, shortcutKeys } = this.state;
    // @ts-expect-error (non strict)
    return activeElement === activeFeature && shortcutKeys[activeElement].error === true
      ? 'error'
      : undefined;
  };

  renderKeyInput = () => {
    const { shortcutKeys, addonsShortcutLabels } = this.state;
    // @ts-expect-error (non strict)
    const arr = Object.entries(shortcutKeys).map(([feature, { shortcut }]: [Feature, any]) => (
      <Row key={feature}>
        {/* @ts-expect-error (non strict) */}
        <Description>{shortcutLabels[feature] || addonsShortcutLabels[feature]}</Description>

        <TextInput
          spellCheck="false"
          valid={this.displayError(feature)}
          className="modalInput"
          onBlur={this.onBlur}
          onFocus={this.onFocus(feature)}
          // @ts-expect-error (Converted from ts-ignore)
          onKeyDown={this.onKeyDown}
          value={shortcut ? shortcutToHumanString(shortcut) : ''}
          placeholder="Type keys"
          readOnly
        />

        {/* @ts-expect-error (non strict) */}
        <SuccessIcon valid={this.displaySuccessMessage(feature)} />
      </Row>
    ));

    return arr;
  };

  renderKeyForm = () => (
    <GridWrapper>
      <GridHeaderRow>
        <HeaderItem>Commands</HeaderItem>
        <HeaderItem>Shortcut</HeaderItem>
      </GridHeaderRow>
      {this.renderKeyInput()}
    </GridWrapper>
  );

  render() {
    const layout = this.renderKeyForm();
    return (
      <Container>
        <Header>Keyboard shortcuts</Header>

        {layout}
        <Button
          variant="outline"
          size="small"
          id="restoreDefaultsHotkeys"
          onClick={this.restoreDefaults}
        >
          Restore defaults
        </Button>

        <SettingsFooter />
      </Container>
    );
  }
}

export { ShortcutsScreen };
