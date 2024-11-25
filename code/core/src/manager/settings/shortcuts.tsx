import type { ComponentProps, FC } from 'react';
import React, { Component } from 'react';

import { Button, Form } from '@storybook/core/components';
import { keyframes, styled } from '@storybook/core/theming';
import { CheckIcon } from '@storybook/icons';

import {
  eventToShortcut,
  shortcutMatchesShortcut,
  shortcutToHumanString,
} from '@storybook/core/manager-api';

import SettingsFooter from './SettingsFooter';

const Header = styled.header(({ theme }) => ({
  marginBottom: 20,
  fontSize: theme.typography.size.m3,
  fontWeight: theme.typography.weight.bold,
  alignItems: 'center',
  display: 'flex',
}));

const GridWrapper = styled.div({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gridAutoRows: 'minmax(auto, auto)',
  marginBottom: 20,
});

const Row = styled.div(({ theme }) => ({
  padding: '6px 0',
  borderTop: `1px solid ${theme.appBorderColor}`,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 0px',
}));

const Description = styled.div({
  alignSelf: 'center',
});

export type ValidationStates = 'valid' | 'error' | 'warn';

const TextInput: FC<ComponentProps<typeof Form.Input> & { valid: ValidationStates }> = styled(
  Form.Input
)<{ valid: ValidationStates }>(
  ({ valid, theme }) => ({
    ...(valid === 'error' ? { animation: `${theme.animation.jiggle} 700ms ease-out` } : {}),
  }),
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

const Fade = keyframes`
  0%,100% { opacity: 0; }
  50% { opacity: 1; }
`;

const SuccessIcon = styled(CheckIcon)<{ valid: string }>(
  ({ valid, theme }) => ({
    ...(valid === 'valid'
      ? { color: theme.color.positive, animation: `${Fade} 2s ease forwards` }
      : { opacity: 0 }),
  }),
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

const fixedShortcuts = ['escape'];

function toShortcutState(shortcutKeys: ShortcutsScreenProps['shortcutKeys']) {
  return Object.entries(shortcutKeys).reduce(
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
      activeFeature: undefined,
      successField: undefined,
      shortcutKeys: toShortcutState(props.shortcutKeys),
      addonsShortcutLabels: props.addonsShortcutLabels,
    };
  }

  handleKeyPress = (e: KeyboardEvent) => {
    const { activeFeature, shortcutKeys } = this.state;

    if (e.key === 'Backspace') {
      return this.restoreDefault();
    }

    const shortcut = eventToShortcut(e);

    if (!shortcut) {
      return false;
    }

    const error = !!Object.entries(shortcutKeys).find(
      ([feature, { shortcut: existingShortcut }]) =>
        feature !== activeFeature &&
        existingShortcut &&
        shortcutMatchesShortcut(shortcut, existingShortcut)
    );

    this.setState({ shortcutKeys: { ...shortcutKeys, [activeFeature]: { shortcut, error } } });
  };

  handleFocus = (focusedInput: Feature) => () => {
    const { shortcutKeys } = this.state;

    this.setState({
      activeFeature: focusedInput,
      shortcutKeys: { ...shortcutKeys, [focusedInput]: { shortcut: null, error: false } },
    });
  };

  handleBlur = async () => {
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
    this.setState({ shortcutKeys: toShortcutState(defaultShortcuts) });
  };

  restoreDefault = async () => {
    const { activeFeature, shortcutKeys } = this.state;
    const { restoreDefaultShortcut } = this.props;
    const defaultShortcut = await restoreDefaultShortcut(activeFeature);
    this.setState({
      shortcutKeys: {
        ...shortcutKeys,
        ...toShortcutState({ [activeFeature]: defaultShortcut } as Record<Feature, any>),
      },
    });
  };

  renderKeyInput = () => {
    const { shortcutKeys, addonsShortcutLabels } = this.state;

    return Object.entries(shortcutKeys).map(([feature, { shortcut }]: [Feature, any]) => (
      <Row key={feature}>
        <Description>{shortcutLabels[feature] || addonsShortcutLabels[feature]}</Description>
        <TextInput
          spellCheck="false"
          valid={this.displayError(feature)}
          onBlur={this.handleBlur}
          onFocus={this.handleFocus(feature)}
          onKeyDown={this.handleKeyPress}
          value={shortcut ? shortcutToHumanString(shortcut) : ''}
          placeholder="Type keys"
          readOnly
        />
        <SuccessIcon valid={this.displaySuccessMessage(feature)} />
      </Row>
    ));
  };

  renderKeyForm = () => (
    <GridWrapper>
      <div>
        <Header>Commands</Header>
        <Header>Shortcut</Header>
      </div>
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
