import React, { useCallback, useState, type FC } from 'react';
import useMeasure from 'react-use-measure';
import {
  Background,
  ButtonsWrapper,
  Circle1,
  Circle2,
  Circle3,
  Content,
  Header,
  Image,
  Main,
  ModalContent,
  ModalTitle,
  ModalWrapper,
  SpanHighlight,
  Step2Text,
} from './WriteStoriesModal.styled';
import { Button } from '../../components/Button/Button';
import { SyntaxHighlighter } from '../../components/SyntaxHighlighter/SyntaxHighlighter';
import { List } from '../../components/List/List';
import { ListItem } from '../../components/List/ListItem/ListItem';
import { useGetButtonPath } from './hooks/useGetButtonPath';
import { useGetWarningButtonStatus } from './hooks/useGetWarningButtonStatus';
import { useGetBackdropBoundary } from './hooks/useGetBackdropBoundary';
import titleSidebarImg from './assets/01-title-sidebar.png';
import storyNameSidebarImg from './assets/02-story-name-sidebar.png';
import argsImg from './assets/03-args.png';
import type { API, AddonStore } from '@storybook/manager-api';
import { STORYBOOK_ADDON_ONBOARDING_CHANNEL } from '../../constants';
import { useTheme } from '@storybook/theming';
import type { CodeSnippets } from './code/types';
import { BookmarkHollowIcon, CrossIcon } from '@storybook/icons';
import { Modal } from '@storybook/components';

// TODO: Add warning if backdropBoundary && !warningButtonStatus?.data is not true.
// backdropBoundary && !warningButtonStatus?.data

interface WriteStoriesModalProps {
  onFinish: () => void;
  api: API;
  addonsStore: AddonStore;
  codeSnippets: CodeSnippets;
  skipOnboarding: () => void;
  container?: HTMLElement;
}

export const WriteStoriesModal: FC<WriteStoriesModalProps> = ({
  onFinish,
  api,
  addonsStore,
  skipOnboarding,
  codeSnippets,
  container,
}) => {
  const [step, setStep] = useState<'imports' | 'meta' | 'story' | 'args' | 'customStory'>(
    'imports'
  );
  const theme = useTheme();

  const stepIndex = {
    imports: 0,
    meta: 1,
    story: 2,
    args: 3,
    customStory: 4,
  };

  const [isWarningStoryCopied, setWarningStoryCopied] = useState(false);

  const [clipboardButtonRef, clipboardButtonBounds] = useMeasure();

  const buttonPath = useGetButtonPath();
  const warningButtonStatus = useGetWarningButtonStatus(step === 'customStory', api, addonsStore);
  const backdropBoundary = useGetBackdropBoundary(
    'syntax-highlighter-backdrop',
    step === 'customStory'
  );

  const isJavascript = codeSnippets?.language === 'javascript';

  const copyWarningStory = () => {
    const warningContent = codeSnippets.code[3][0].snippet;
    navigator.clipboard.writeText(warningContent.replace('// Copy the code below', ''));
    setWarningStoryCopied(true);
  };

  const onModalClose = useCallback(() => {
    api.emit(STORYBOOK_ADDON_ONBOARDING_CHANNEL, {
      step: 'X:SkippedOnboarding',
      where: `HowToWriteAStoryModal:${step}`,
      type: 'telemetry',
    });
  }, [api, step]);

  return (
    <ModalWrapper width={740} height={430} container={container} defaultOpen>
      <ModalContent>
        {codeSnippets ? (
          <SyntaxHighlighter
            activeStep={stepIndex[step] || 0}
            data={codeSnippets.code}
            width={480}
            filename={codeSnippets.filename}
          />
        ) : null}
        {step === 'customStory' && backdropBoundary && !warningButtonStatus?.data && (
          <Button
            ref={clipboardButtonRef}
            onClick={() => copyWarningStory()}
            style={{
              position: 'absolute',
              opacity: clipboardButtonBounds.width ? 1 : 0,
              top: backdropBoundary.top + backdropBoundary.height - 45,
              left:
                backdropBoundary.left +
                backdropBoundary.width -
                (clipboardButtonBounds.width ?? 0) -
                10,
              zIndex: 1000,
            }}
          >
            {isWarningStoryCopied ? 'Copied to clipboard' : 'Copy code'}
          </Button>
        )}
        <Main>
          <Background>
            <Circle1 />
            <Circle2 />
            <Circle3 />
          </Background>

          <Header>
            <Modal.Title asChild>
              <ModalTitle>
                <BookmarkHollowIcon width={13} />
                <span>How to write a story</span>
              </ModalTitle>
            </Modal.Title>
            <Modal.Dialog.Close onClick={onModalClose} asChild>
              <CrossIcon
                style={{ cursor: 'pointer' }}
                width={13}
                onClick={skipOnboarding}
                color={theme.color.darkest}
              />
            </Modal.Dialog.Close>
          </Header>
          <Modal.Description asChild>
            <Content>
              {step === 'imports' && (
                <>
                  <div>
                    <h3>Imports</h3>
                    {isJavascript ? (
                      <p>Import a component. In this case, the Button component.</p>
                    ) : (
                      <>
                        <p>
                          First, import <SpanHighlight>Meta</SpanHighlight> and{' '}
                          <SpanHighlight>StoryObj</SpanHighlight> for type safety and autocompletion
                          in TypeScript stories.
                        </p>
                        <p>Next, import a component. In this case, the Button component.</p>
                      </>
                    )}
                  </div>
                  <Button
                    style={{ marginTop: 4 }}
                    onClick={() => {
                      setStep('meta');
                    }}
                  >
                    Next
                  </Button>
                </>
              )}
              {step === 'meta' && (
                <>
                  <div>
                    <h3>Meta</h3>
                    <p>
                      The default export, Meta, contains metadata about this component's stories.
                      The title field (optional) controls where stories appear in the sidebar.
                    </p>
                    <Image
                      width="204"
                      alt="Title property pointing to Storybook's sidebar"
                      src={titleSidebarImg}
                    />
                  </div>
                  <ButtonsWrapper>
                    <Button variant="secondary" onClick={() => setStep('imports')}>
                      Previous
                    </Button>
                    <Button onClick={() => setStep('story')}>Next</Button>
                  </ButtonsWrapper>
                </>
              )}
              {step === 'story' && (
                <>
                  <div>
                    <h3>Story</h3>
                    <p>
                      Each named export is a story. Its contents specify how the story is rendered
                      in addition to other configuration options.
                    </p>
                    <Image
                      width="190"
                      alt="Story export pointing to the sidebar entry of the story"
                      src={storyNameSidebarImg}
                    />
                  </div>
                  <ButtonsWrapper>
                    <Button variant="secondary" onClick={() => setStep('meta')}>
                      Previous
                    </Button>
                    <Button onClick={() => setStep('args')}>Next</Button>
                  </ButtonsWrapper>
                </>
              )}
              {step === 'args' && (
                <>
                  <div>
                    <h3>Args</h3>
                    <p>
                      Args are inputs that are passed to the component, which Storybook uses to
                      render the component in different states. In React, args = props. They also
                      specify the initial control values for the story.
                    </p>
                    <Image
                      alt="Args mapped to their controls in Storybook"
                      width="253"
                      src={argsImg}
                    />
                  </div>
                  <ButtonsWrapper>
                    <Button variant="secondary" onClick={() => setStep('story')}>
                      Previous
                    </Button>
                    <Button onClick={() => setStep('customStory')}>Next</Button>
                  </ButtonsWrapper>
                </>
              )}
              {step === 'customStory' &&
                (!warningButtonStatus?.error ? (
                  <>
                    <div>
                      <h3>Create your first story</h3>
                      <p>
                        Now it's your turn. See how easy it is to create your first story by
                        following these steps below.
                      </p>
                      <List>
                        <ListItem
                          isCompleted={isWarningStoryCopied || !!warningButtonStatus?.data}
                          index={1}
                        >
                          Copy the Warning story.
                        </ListItem>
                        <ListItem isCompleted={!!warningButtonStatus?.data} index={2}>
                          <Step2Text>
                            Open the Button story in your current working directory.
                          </Step2Text>
                          {buttonPath?.data && (
                            // Replace '/' by '/<zero-width-place>' to properly break line
                            <SpanHighlight>
                              {buttonPath.data.replaceAll('/', '/​').replaceAll('\\', '\\​')}
                            </SpanHighlight>
                          )}
                        </ListItem>
                        <ListItem isCompleted={!!warningButtonStatus?.data} index={3}>
                          Paste it at the bottom of the file and save.
                        </ListItem>
                      </List>
                    </div>
                    <ButtonsWrapper>
                      <Button variant="secondary" onClick={() => setStep('args')}>
                        Previous
                      </Button>
                      {warningButtonStatus?.data ? (
                        <Button onClick={() => onFinish()}>Go to story</Button>
                      ) : null}
                    </ButtonsWrapper>
                  </>
                ) : null)}
            </Content>
          </Modal.Description>
        </Main>
      </ModalContent>
    </ModalWrapper>
  );
};
