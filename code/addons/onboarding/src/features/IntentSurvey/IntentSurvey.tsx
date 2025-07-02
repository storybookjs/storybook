import React, { useState } from 'react';

import { Button, Form, Modal } from 'storybook/internal/components';

import { styled } from 'storybook/theming';

const Content = styled(Modal.Content)(({ theme }) => ({
  fontSize: theme.typography.size.s2,
  color: theme.color.defaultText,
  gap: 8,
}));

const Row = styled.div({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 14,
  marginBottom: 8,
});

const Question = styled.div(({ theme }) => ({
  marginTop: 8,
  marginBottom: 2,
  fontWeight: theme.typography.weight.bold,
}));

const Label = styled.label({
  display: 'flex',
  gap: 8,

  '&:has(input[type="checkbox"]:not(:disabled), input[type="radio"]:not(:disabled))': {
    cursor: 'pointer',
  },
});

const Checkbox = styled(Form.Checkbox)({
  margin: 2,
});

export const IntentSurvey = ({ onDismiss }: { onDismiss: () => void }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmitForm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
  };

  return (
    <Modal defaultOpen width={420} onEscapeKeyDown={onDismiss}>
      <Form onSubmit={onSubmitForm} id="create-new-story-form">
        <Content>
          <Modal.Header>
            <Modal.Title>Help improve Storybook</Modal.Title>
          </Modal.Header>

          <Question>What are you building?</Question>
          <Row>
            <div>
              <Label htmlFor="building:design-system">
                <Checkbox id="building:design-system" disabled={isSubmitting} />
                Design system
              </Label>
            </div>
            <div>
              <Label htmlFor="building:application-ui">
                <Checkbox id="building:application-ui" disabled={isSubmitting} />
                Application UI
              </Label>
            </div>
          </Row>

          <Question>Which of these are you interested in?</Question>
          <Row>
            <div>
              <Label htmlFor="use:ui-documentation">
                <Checkbox id="use:ui-documentation" disabled={isSubmitting} />
                Generating UI docs
              </Label>
            </div>
            <div>
              <Label htmlFor="use:functional-testing">
                <Checkbox id="use:functional-testing" disabled={isSubmitting} />
                Functional testing
              </Label>
            </div>
            <div>
              <Label htmlFor="use:accessibility-testing">
                <Checkbox id="use:accessibility-testing" disabled={isSubmitting} />
                Accessibility testing
              </Label>
            </div>
            <div>
              <Label htmlFor="use:visual-testing">
                <Checkbox id="use:visual-testing" disabled={isSubmitting} />
                Visual testing
              </Label>
            </div>
            <div>
              <Label htmlFor="use:ai-augmented-development">
                <Checkbox id="use:ai-augmented-development" disabled={isSubmitting} />
                Building UI with AI
              </Label>
            </div>
            <div>
              <Label htmlFor="use:team-collaboration">
                <Checkbox id="use:team-collaboration" disabled={isSubmitting} />
                Team collaboration
              </Label>
            </div>
            <div>
              <Label htmlFor="use:design-handoff">
                <Checkbox id="use:design-handoff" disabled={isSubmitting} />
                Design handoff
              </Label>
            </div>
          </Row>

          <Question>How did you learn about Storybook?</Question>
          <Form.Select>
            <option value="we-use-it-at-work">We use it at work</option>
            <option value="via-friend-or-colleague">Via friend or colleague</option>
            <option value="via-social-media">Via social media</option>
            <option value="youtube">YouTube</option>
            <option value="web-search">Web Search</option>
            <option value="ai-agent">AI Agent (e.g. ChatGPT)</option>
          </Form.Select>

          <Modal.Actions>
            <Button disabled={isSubmitting} size="medium" type="submit" variant="solid">
              Submit
            </Button>
          </Modal.Actions>
        </Content>
      </Form>
    </Modal>
  );
};
